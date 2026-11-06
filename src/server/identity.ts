/**
 * Identity: maps a managed-auth (Clerk) session onto a proovd user and Actor.
 *
 * Pure database logic, no Clerk SDK calls, so it runs the same in tests. session.ts reads the Clerk
 * session and passes the claims in.
 *
 *  - users.auth_subject holds the Clerk user id; email and name are copied once at onboarding.
 *  - Brand teams live in Clerk organisations (invites, removals, roles). The *active* organisation in
 *    the session decides the actor's orgId on every request, so a removed teammate loses access as
 *    soon as their session token refreshes (≤ 60 s). `memberships` is a local mirror for joins and
 *    notifications, written when a member is first seen.
 *  - MFA is required for brand owners (Clerk role org:admin) and platform operations.
 */
import { and, eq } from "drizzle-orm";
import { creatorProfiles, memberships, organizations, users } from "@/db/schema";
import { DomainError } from "@/domain/types";
import { ForbiddenError, audit, loadActor, type Actor, type Executor } from "./core";

export const OWNER_ROLE = "org:admin";

export interface SessionClaims {
  /** Clerk user id (user_…). */
  subject: string;
  /** Active Clerk organisation, if any. */
  orgId: string | null;
  orgRole: string | null;
  /** Minutes since a second factor was verified in this session; -1 or null when never. */
  secondFactorAge: number | null;
}

export type IdentityState =
  | { kind: "ok"; actor: Actor }
  /** Signed in with Clerk but no proovd account yet. */
  | { kind: "onboarding" }
  /** Brand user whose active Clerk organisation is missing or not set up in proovd yet. */
  | { kind: "brand_setup"; actor: Actor }
  /** Brand owner or ops whose session was not verified with a second factor. */
  | { kind: "mfa_required"; actor: Actor }
  | { kind: "disabled" };

export const mfaRequired = (role: Actor["role"], orgRole: string | null) =>
  role === "admin" || (role === "brand" && orgRole === OWNER_ROLE);

const memberRole = (orgRole: string | null) => (orgRole === OWNER_ROLE ? "owner" : "member");

export async function resolveIdentity(db: Executor, c: SessionClaims): Promise<IdentityState> {
  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.authSubject, c.subject)).limit(1);
  if (!u) return { kind: "onboarding" };
  const loaded = await loadActor(db, u.id);
  if (!loaded) return { kind: "disabled" };
  let actor: Actor = loaded;

  if (actor.role === "brand") {
    // Never trust the first local membership: the session's active organisation is the source of truth.
    actor = { ...actor, orgId: null };
    const [org] = c.orgId
      ? await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.clerkOrgId, c.orgId)).limit(1)
      : [];
    if (!org) return { kind: "brand_setup", actor };
    await mirrorMembership(db, actor, org.id, memberRole(c.orgRole));
    actor = { ...actor, orgId: org.id };
  }

  if (mfaRequired(actor.role, c.orgRole) && !(c.secondFactorAge !== null && c.secondFactorAge >= 0)) {
    return { kind: "mfa_required", actor };
  }
  return { kind: "ok", actor };
}

async function mirrorMembership(db: Executor, actor: Actor, orgId: string, role: string) {
  const [m] = await db
    .select({ id: memberships.id, role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.userId, actor.userId), eq(memberships.organizationId, orgId)))
    .limit(1);
  if (m?.role === role) return;
  if (m) {
    await db.update(memberships).set({ role }).where(eq(memberships.id, m.id));
    await audit(db, actor, "organization", orgId, "member_role_changed", { userId: actor.userId, role });
    return;
  }
  await db.insert(memberships).values({ userId: actor.userId, organizationId: orgId, role }).onConflictDoNothing();
  await audit(db, actor, "organization", orgId, "member_joined", { userId: actor.userId, role });
}

export interface OnboardInput {
  subject: string;
  email: string;
  emailVerified: boolean;
  name: string;
  /** What the person picked. Ignored for allow-listed ops and for invitees joining a set-up brand org. */
  choice: "brand" | "creator";
  orgId: string | null;
  opsEmails: Set<string>;
}

/** Creates the proovd user for a Clerk identity. Idempotent per subject. Returns the user's role. */
export async function onboard(db: Executor, input: OnboardInput): Promise<Actor["role"]> {
  const [existing] = await db.select({ role: users.role }).from(users).where(eq(users.authSubject, input.subject)).limit(1);
  if (existing) return existing.role;

  const email = input.email.trim().toLowerCase();
  const name = input.name.trim() || email.split("@")[0]!;
  if (!email) throw new DomainError("Your account has no email address");
  const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (taken) throw new DomainError("An account with this email already exists. Sign in with that account instead.");

  const joiningOrg = input.orgId
    ? (await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.clerkOrgId, input.orgId)).limit(1))[0]
    : undefined;
  const role: Actor["role"] = input.emailVerified && input.opsEmails.has(email) ? "admin" : joiningOrg ? "brand" : input.choice;

  const [u] = await db
    .insert(users)
    .values({ authSubject: input.subject, email, name, role })
    .onConflictDoNothing({ target: users.authSubject })
    .returning({ id: users.id });
  // A concurrent submit already created this person.
  if (!u) return (await db.select({ role: users.role }).from(users).where(eq(users.authSubject, input.subject)))[0]!.role;
  if (role === "creator") await db.insert(creatorProfiles).values({ userId: u!.id, displayName: name });
  await audit(db, null, "user", u!.id, "signed_up", { role });
  return role;
}

export interface BrandSetupInput {
  subject: string;
  orgId: string | null;
  orgRole: string | null;
  legalName: string;
  displayName: string;
  category: string;
  website: string | null;
}

/** Links the owner's active Clerk organisation to a new proovd brand organisation. Idempotent per Clerk org. */
export async function setupBrandOrganization(db: Executor, input: BrandSetupInput): Promise<string> {
  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.authSubject, input.subject)).limit(1);
  const actor = u ? await loadActor(db, u.id) : null;
  if (!actor || actor.role !== "brand") throw new ForbiddenError("Only brand accounts can set up a brand");
  if (!input.orgId) throw new DomainError("Create or pick your team first");
  if (input.orgRole !== OWNER_ROLE) throw new ForbiddenError("Only the team owner can set up the brand");

  const [linked] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.clerkOrgId, input.orgId)).limit(1);
  if (linked) return linked.id;

  const legalName = input.legalName.trim();
  const displayName = input.displayName.trim() || legalName;
  if (!legalName) throw new DomainError("Enter your company's legal name");
  const [org] = await db
    .insert(organizations)
    .values({ clerkOrgId: input.orgId, legalName, displayName, category: input.category.trim() || "D2C", website: input.website?.trim() || null })
    .onConflictDoNothing({ target: organizations.clerkOrgId })
    .returning({ id: organizations.id });
  if (!org) return (await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.clerkOrgId, input.orgId)))[0]!.id;
  await db.insert(memberships).values({ userId: actor.userId, organizationId: org!.id, role: "owner" });
  await audit(db, actor, "organization", org!.id, "created", { clerkOrgId: input.orgId });
  return org!.id;
}
