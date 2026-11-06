import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, schema, type DB } from "@/db";
import { authMode } from "@/server/env";
import { onboard, resolveIdentity, setupBrandOrganization, type OnboardInput, type SessionClaims } from "@/server/identity";

let db: DB;
beforeAll(async () => {
  db = await createTestDb(false);
});

const claims = (subject: string, over: Partial<SessionClaims> = {}): SessionClaims => ({ subject, orgId: null, orgRole: null, secondFactorAge: -1, ...over });
const input = (subject: string, over: Partial<OnboardInput> = {}): OnboardInput => ({
  subject,
  email: `${subject}@example.com`,
  emailVerified: true,
  name: subject,
  acceptedNotice: true,
  productEmails: false,
  choice: "creator",
  orgId: null,
  opsEmails: new Set(),
  ...over,
});

describe("identity: Clerk session → actor", () => {
  it("a new Clerk user must onboard first", async () => {
    expect(await resolveIdentity(db, claims("user_new"))).toEqual({ kind: "onboarding" });
  });

  it("creator onboarding creates a user and creator profile, idempotently", async () => {
    expect(await onboard(db, input("user_c1", { email: "C1@Example.com " }))).toBe("creator");
    expect(await onboard(db, input("user_c1"))).toBe("creator");
    const s = await resolveIdentity(db, claims("user_c1"));
    expect(s.kind).toBe("ok");
    if (s.kind !== "ok") return;
    expect(s.actor.role).toBe("creator");
    expect(s.actor.email).toBe("c1@example.com");
    expect(s.actor.creatorProfileId).toBeTruthy();
  });

  it("refuses a second account for an email that is already used", async () => {
    await expect(onboard(db, input("user_c1_dup", { email: "c1@example.com" }))).rejects.toThrow(/already exists/);
  });

  it("only verified, allow-listed emails become ops, and ops need MFA", async () => {
    const ops = new Set(["ops@example.com"]);
    expect(await onboard(db, input("user_unverified", { email: "ops@example.com", emailVerified: false, opsEmails: ops }))).toBe("creator");
    expect(await onboard(db, input("user_ops", { email: "ops2@example.com", opsEmails: new Set(["ops2@example.com"]), choice: "brand" }))).toBe("admin");
    expect((await resolveIdentity(db, claims("user_ops"))).kind).toBe("mfa_required");
    expect((await resolveIdentity(db, claims("user_ops", { secondFactorAge: 0 }))).kind).toBe("ok");
  });

  describe("brands", () => {
    it("owner: pick a team → set up the brand → MFA → in", async () => {
      expect(await onboard(db, input("user_owner", { choice: "brand" }))).toBe("brand");
      expect((await resolveIdentity(db, claims("user_owner"))).kind).toBe("brand_setup");
      const owner = claims("user_owner", { orgId: "org_a", orgRole: "org:admin" });
      expect((await resolveIdentity(db, owner)).kind).toBe("brand_setup");

      const orgId = await setupBrandOrganization(db, { subject: "user_owner", orgId: "org_a", orgRole: "org:admin", legalName: "Acme Pvt Ltd", displayName: "", category: "D2C", website: null });
      expect(await setupBrandOrganization(db, { subject: "user_owner", orgId: "org_a", orgRole: "org:admin", legalName: "Again", displayName: "", category: "D2C", website: null })).toBe(orgId);
      const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, orgId));
      expect(org!.displayName).toBe("Acme Pvt Ltd");

      expect((await resolveIdentity(db, owner)).kind).toBe("mfa_required");
      const s = await resolveIdentity(db, { ...owner, secondFactorAge: 3 });
      expect(s.kind === "ok" && s.actor.orgId).toBe(orgId);
    });

    it("only the Clerk org owner can set up the brand", async () => {
      await onboard(db, input("user_m0", { choice: "brand" }));
      await expect(setupBrandOrganization(db, { subject: "user_m0", orgId: "org_b", orgRole: "org:member", legalName: "B", displayName: "", category: "D2C", website: null })).rejects.toThrow(/owner/);
      await expect(setupBrandOrganization(db, { subject: "user_c1", orgId: "org_b", orgRole: "org:admin", legalName: "B", displayName: "", category: "D2C", website: null })).rejects.toThrow(/brand accounts/);
    });

    it("an invited member joins the team's org without MFA and is mirrored in memberships", async () => {
      expect(await onboard(db, input("user_member", { choice: "creator", orgId: "org_a" }))).toBe("brand");
      const s = await resolveIdentity(db, claims("user_member", { orgId: "org_a", orgRole: "org:member" }));
      expect(s.kind).toBe("ok");
      if (s.kind !== "ok") return;
      const rows = await db.select().from(schema.memberships).where(eq(schema.memberships.userId, s.actor.userId));
      expect(rows.map((r) => [r.organizationId, r.role])).toEqual([[s.actor.orgId, "member"]]);
    });

    it("the session's active org decides access: removed or foreign org means no brand access", async () => {
      // Removed from the team in Clerk: the session no longer carries org_a.
      expect((await resolveIdentity(db, claims("user_member"))).kind).toBe("brand_setup");
      // An org that exists in Clerk but was never set up in proovd.
      expect((await resolveIdentity(db, claims("user_member", { orgId: "org_unknown", orgRole: "org:member" }))).kind).toBe("brand_setup");
    });

    it("a promotion to owner updates the mirror and then requires MFA", async () => {
      const promoted = claims("user_member", { orgId: "org_a", orgRole: "org:admin" });
      expect((await resolveIdentity(db, promoted)).kind).toBe("mfa_required");
      const [u] = await db.select().from(schema.users).where(eq(schema.users.authSubject, "user_member"));
      const [m] = await db.select().from(schema.memberships).where(eq(schema.memberships.userId, u!.id));
      expect(m!.role).toBe("owner");
    });
  });

  it("suspended users are refused", async () => {
    await db.update(schema.users).set({ status: "suspended" }).where(eq(schema.users.authSubject, "user_c1"));
    expect(await resolveIdentity(db, claims("user_c1"))).toEqual({ kind: "disabled" });
  });
});

describe("auth mode", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });
  const set = (env: Record<string, string | undefined>) => {
    for (const [k, v] of Object.entries(env)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  };
  const keys = { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_x", CLERK_SECRET_KEY: "sk_test_x" };
  const noKeys = { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: undefined, CLERK_SECRET_KEY: undefined };

  it("demo always uses the cookie picker, even with Clerk keys", () => {
    set({ APP_ENV: "demo", ...keys });
    expect(authMode()).toBe("cookie");
  });
  it("development uses Clerk when keys exist, the cookie otherwise", () => {
    set({ APP_ENV: "development", ...keys });
    expect(authMode()).toBe("clerk");
    set(noKeys);
    expect(authMode()).toBe("cookie");
  });
  it("staging and production without Clerk keys fail closed: nobody can sign in", () => {
    set({ APP_ENV: "staging", ...noKeys });
    expect(authMode()).toBe("off");
    set({ APP_ENV: "production", ...keys });
    expect(authMode()).toBe("clerk");
  });
});
