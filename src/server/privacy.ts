/**
 * DPDP groundwork: consent log, "download my data" and "delete my account" (ADR-005).
 *
 *  - Consent is recorded at sign-up against a versioned privacy notice. The log is append-only.
 *  - Requests are rows in data_requests with a 90-day due date; a job does the work.
 *  - Erasure pseudonymises personal data and keeps money and audit records by id. It is blocked
 *    while the person still has open collaborations, pending payouts or open disputes, because those
 *    records are needed to settle what is owed (a legal-obligation basis for keeping them).
 *  - Erasure also deletes the Clerk identity. That call happens in the job, outside any transaction.
 */
import { and, desc, eq, inArray, isNotNull, lt, sql } from "drizzle-orm";
import type { DB } from "@/db";
import {
  agreements,
  applications,
  consents,
  creatorProfiles,
  dataRequests,
  disputes,
  memberships,
  notifications,
  organizations,
  paymentTransfers,
  portfolioItems,
  socialAccounts,
  users,
} from "@/db/schema";
import { DomainError } from "@/domain/types";
import { NotFoundError, assertUuid, audit, notify, requireAdmin, type Actor, type Executor } from "./core";
import { enqueue } from "./jobs";

/** Bump when the privacy notice changes materially; new consents record the version seen. */
export const NOTICE_VERSION = "2026-11-06";
export const CONSENT_PURPOSES = ["account", "product_emails"] as const;
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

const DAY = 86_400_000;
export const RESPONSE_DAYS = 90;
export const EXPORT_KEEP_DAYS = 7;

export async function recordConsent(db: Executor, userId: string, purpose: ConsentPurpose, granted: boolean, noticeVersion = NOTICE_VERSION) {
  await db.insert(consents).values({ userId, purpose, granted, noticeVersion });
}

/** Latest decision per purpose. */
export async function currentConsents(db: Executor, userId: string): Promise<Record<ConsentPurpose, { granted: boolean; noticeVersion: string; at: Date } | null>> {
  const rows = await db.select().from(consents).where(eq(consents.userId, userId)).orderBy(desc(consents.createdAt));
  const out = { account: null, product_emails: null } as Record<ConsentPurpose, { granted: boolean; noticeVersion: string; at: Date } | null>;
  for (const r of rows) {
    const p = r.purpose as ConsentPurpose;
    if (p in out && !out[p]) out[p] = { granted: r.granted, noticeVersion: r.noticeVersion, at: r.createdAt };
  }
  return out;
}

export async function setProductEmails(db: Executor, actor: Actor, granted: boolean) {
  await recordConsent(db, actor.userId, "product_emails", granted);
  await audit(db, actor, "user", actor.userId, granted ? "consent_granted" : "consent_withdrawn", { purpose: "product_emails" });
}

async function openRequest(db: Executor, userId: string, kind: "export" | "erasure") {
  const [r] = await db
    .select({ id: dataRequests.id })
    .from(dataRequests)
    .where(and(eq(dataRequests.userId, userId), eq(dataRequests.kind, kind), eq(dataRequests.status, "queued")))
    .limit(1);
  return r;
}

export async function requestExport(db: Executor, actor: Actor) {
  if (await openRequest(db, actor.userId, "export")) throw new DomainError("Your export is already being prepared");
  const [r] = await db
    .insert(dataRequests)
    .values({ userId: actor.userId, kind: "export", dueAt: new Date(Date.now() + RESPONSE_DAYS * DAY) })
    .returning({ id: dataRequests.id });
  await enqueue(db, "privacy.export", { requestId: r!.id }, { key: `privacy.export:${r!.id}` });
  await audit(db, actor, "data_request", r!.id, "requested", { kind: "export" });
  return r!.id;
}

export async function requestErasure(db: Executor, actor: Actor, confirmation: string) {
  if (confirmation.trim().toLowerCase() !== actor.email.toLowerCase()) throw new DomainError("Type your email address exactly to confirm");
  if (await openRequest(db, actor.userId, "erasure")) throw new DomainError("Your deletion request is already in progress");
  const [r] = await db
    .insert(dataRequests)
    .values({ userId: actor.userId, kind: "erasure", dueAt: new Date(Date.now() + RESPONSE_DAYS * DAY) })
    .returning({ id: dataRequests.id });
  await enqueue(db, "privacy.erasure", { requestId: r!.id }, { key: `privacy.erasure:${r!.id}` });
  await audit(db, actor, "data_request", r!.id, "requested", { kind: "erasure" });
  return r!.id;
}

export async function listMyRequests(db: Executor, actor: Actor) {
  return db
    .select({ id: dataRequests.id, kind: dataRequests.kind, status: dataRequests.status, reason: dataRequests.reason, hasResult: sql<boolean>`${dataRequests.result} is not null`, createdAt: dataRequests.createdAt, completedAt: dataRequests.completedAt })
    .from(dataRequests)
    .where(eq(dataRequests.userId, actor.userId))
    .orderBy(desc(dataRequests.createdAt))
    .limit(20);
}

/** The export bundle, for its owner only. Missing, foreign and expired exports all look the same. */
export async function getExport(db: Executor, actor: Actor, requestId: string) {
  assertUuid(requestId, "Export");
  const [r] = await db.select().from(dataRequests).where(eq(dataRequests.id, requestId)).limit(1);
  if (!r || r.userId !== actor.userId || r.kind !== "export" || r.status !== "completed" || !r.result) throw new NotFoundError("Export");
  return r.result;
}

/** Ops view: everything not yet completed, oldest due first. */
export async function openDataRequests(db: Executor, actor: Actor) {
  requireAdmin(actor);
  return db
    .select({ r: dataRequests, email: users.email, name: users.name })
    .from(dataRequests)
    .innerJoin(users, eq(dataRequests.userId, users.id))
    .where(inArray(dataRequests.status, ["queued", "blocked"]))
    .orderBy(dataRequests.dueAt)
    .limit(200);
}

// ---------- jobs ----------

async function collectPersonalData(db: Executor, userId: string) {
  const [user] = await db.select({ id: users.id, email: users.email, name: users.name, role: users.role, createdAt: users.createdAt }).from(users).where(eq(users.id, userId));
  const orgs = await db
    .select({ organization: organizations.displayName, role: memberships.role, since: memberships.createdAt })
    .from(memberships)
    .innerJoin(organizations, eq(memberships.organizationId, organizations.id))
    .where(eq(memberships.userId, userId));
  const [profile] = await db.select().from(creatorProfiles).where(eq(creatorProfiles.userId, userId));
  const creator = profile
    ? {
        profile,
        portfolio: await db.select().from(portfolioItems).where(eq(portfolioItems.creatorProfileId, profile.id)),
        socialAccounts: (await db.select().from(socialAccounts).where(eq(socialAccounts.creatorProfileId, profile.id))).map((a) => ({ ...a, tokenSecretRef: undefined })),
        applications: await db.select().from(applications).where(eq(applications.creatorProfileId, profile.id)),
        agreements: await db
          .select({ id: agreements.id, version: agreements.version, status: agreements.status, compensationModel: agreements.compensationModel, createdAt: agreements.createdAt })
          .from(agreements)
          .where(eq(agreements.creatorProfileId, profile.id)),
      }
    : null;
  return {
    generatedAt: new Date().toISOString(),
    noticeVersion: NOTICE_VERSION,
    user,
    organizations: orgs,
    creator,
    consents: await db.select({ purpose: consents.purpose, granted: consents.granted, noticeVersion: consents.noticeVersion, at: consents.createdAt }).from(consents).where(eq(consents.userId, userId)),
    notifications: await db.select({ title: notifications.title, body: notifications.body, at: notifications.createdAt }).from(notifications).where(eq(notifications.userId, userId)),
  };
}

export async function processExport(db: DB, requestId: string) {
  const [r] = await db.select().from(dataRequests).where(eq(dataRequests.id, requestId));
  if (!r || r.status !== "queued") return;
  const bundle = JSON.parse(JSON.stringify(await collectPersonalData(db, r.userId))) as Record<string, unknown>;
  await db.transaction(async (tx) => {
    const done = await tx
      .update(dataRequests)
      .set({ status: "completed", result: bundle, completedAt: new Date() })
      .where(and(eq(dataRequests.id, requestId), eq(dataRequests.status, "queued")))
      .returning({ id: dataRequests.id });
    if (done.length === 0) return;
    await audit(tx, null, "data_request", requestId, "completed", { kind: "export" });
    await notify(tx, [r.userId], "Your data export is ready", `Download it within ${EXPORT_KEEP_DAYS} days from Settings → Privacy.`, "/settings#privacy");
  });
}

/** Reasons the person's records are still needed to settle money. Empty means erasure can proceed. */
export async function erasureBlockers(db: Executor, userId: string): Promise<string[]> {
  const out: string[] = [];
  const [profile] = await db.select({ id: creatorProfiles.id }).from(creatorProfiles).where(eq(creatorProfiles.userId, userId));
  if (profile) {
    const open = await db
      .select({ id: agreements.id })
      .from(agreements)
      .where(and(eq(agreements.creatorProfileId, profile.id), inArray(agreements.status, ["offered", "accepted", "disputed"])));
    if (open.length) out.push(`${open.length} collaboration${open.length > 1 ? "s are" : " is"} still open`);
    const all = await db.select({ id: agreements.id }).from(agreements).where(eq(agreements.creatorProfileId, profile.id));
    if (all.length) {
      const ids = all.map((a) => a.id);
      const [pending] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(paymentTransfers)
        .where(and(inArray(paymentTransfers.agreementId, ids), eq(paymentTransfers.state, "transfer_pending")));
      if (pending!.n) out.push("a payout to you is still pending");
      const [disp] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(disputes)
        .where(and(inArray(disputes.agreementId, ids), inArray(disputes.state, ["open", "under_review"])));
      if (disp!.n) out.push("a dispute is still open");
    }
  }
  // A brand left without an owner can't manage its team, billing or campaigns.
  const owned = await db.select({ orgId: memberships.organizationId }).from(memberships).where(and(eq(memberships.userId, userId), eq(memberships.role, "owner")));
  for (const { orgId } of owned) {
    const [others] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(memberships)
      .where(and(eq(memberships.organizationId, orgId), eq(memberships.role, "owner"), sql`${memberships.userId} <> ${userId}`));
    if (!others!.n) out.push("you are the only owner of a brand team (make a teammate an owner first)");
  }
  return out;
}

/** Deletes the person's Clerk user. Idempotent: an already-deleted user is fine. */
export async function deleteClerkUser(subject: string): Promise<void> {
  if (!subject.startsWith("user_")) return; // demo/seeded accounts have no Clerk identity
  const key = process.env.CLERK_SECRET_KEY;
  if (!key) throw new Error("CLERK_SECRET_KEY is required to delete a Clerk user");
  const res = await fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(subject)}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok && res.status !== 404) throw new Error(`Clerk delete user ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

export async function processErasure(db: DB, requestId: string, deleteIdentity: (subject: string) => Promise<void> = deleteClerkUser) {
  const [r] = await db.select().from(dataRequests).where(eq(dataRequests.id, requestId));
  if (!r || r.status !== "queued") return;
  const [u] = await db.select().from(users).where(eq(users.id, r.userId));
  if (!u) return;

  const blockers = await erasureBlockers(db, u.id);
  if (blockers.length) {
    const reason = `We can't delete your account yet: ${blockers.join("; ")}. Request again once everything is settled.`;
    await db.transaction(async (tx) => {
      await tx.update(dataRequests).set({ status: "blocked", reason, completedAt: new Date() }).where(eq(dataRequests.id, requestId));
      await audit(tx, null, "data_request", requestId, "blocked", { blockers });
      await notify(tx, [u.id], "Account deletion on hold", reason, "/settings#privacy");
    });
    return;
  }

  // External call first and outside the transaction; safe to repeat if the job retries.
  if (!u.authSubject.startsWith("deleted:")) await deleteIdentity(u.authSubject);

  await db.transaction(async (tx) => {
    const erased = `deleted-${u.id}`;
    await tx
      .update(users)
      .set({ name: "Deleted user", email: `${erased}@erased.invalid`, authSubject: `deleted:${u.id}`, status: "deleted" })
      .where(eq(users.id, u.id));
    const [profile] = await tx.select({ id: creatorProfiles.id }).from(creatorProfiles).where(eq(creatorProfiles.userId, u.id));
    if (profile) {
      await tx
        .update(creatorProfiles)
        .set({ displayName: "Deleted creator", headline: "", bio: "", location: "", languages: [], visibility: "private", updatedAt: new Date() })
        .where(eq(creatorProfiles.id, profile.id));
      await tx.delete(portfolioItems).where(eq(portfolioItems.creatorProfileId, profile.id));
      await tx
        .update(socialAccounts)
        .set({ handle: "deleted", externalId: null, tokenSecretRef: null, connectionState: "disconnected", disconnectedAt: new Date() })
        .where(eq(socialAccounts.creatorProfileId, profile.id));
      await tx.update(applications).set({ pitch: "[erased]", availability: "" }).where(eq(applications.creatorProfileId, profile.id));
    }
    await tx.delete(memberships).where(eq(memberships.userId, u.id));
    await tx.delete(notifications).where(eq(notifications.userId, u.id));
    // Other exports of this person are personal data too.
    await tx.update(dataRequests).set({ result: null }).where(eq(dataRequests.userId, u.id));
    await tx.update(dataRequests).set({ status: "completed", completedAt: new Date() }).where(eq(dataRequests.id, requestId));
    await audit(tx, null, "data_request", requestId, "completed", { kind: "erasure", userId: u.id });
  });
}

/** Clears export bundles older than EXPORT_KEEP_DAYS. Run by the hourly maintenance job. */
export async function expireExports(db: Executor, now = new Date()) {
  await db
    .update(dataRequests)
    .set({ result: null })
    .where(and(eq(dataRequests.kind, "export"), isNotNull(dataRequests.result), lt(dataRequests.completedAt, new Date(now.getTime() - EXPORT_KEEP_DAYS * DAY))));
}
