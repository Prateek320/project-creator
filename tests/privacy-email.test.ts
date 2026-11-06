import { beforeAll, describe, expect, it } from "vitest";
import { and, eq, notInArray, sql } from "drizzle-orm";
import { createTestDb, schema, type DB } from "@/db";
import { loadActor, notify, type Actor } from "@/server/core";
import { PermanentEmailError, mockOutbox, processEmailSend, type EmailProvider } from "@/server/email";
import { runJobs } from "@/server/job-handlers";
import * as privacy from "@/server/privacy";
import * as collab from "@/server/collaborations";
import { onboard } from "@/server/identity";
import { DomainError } from "@/domain/types";

let db: DB;
const actorByEmail = async (email: string) => {
  const [u] = await db.select().from(schema.users).where(eq(schema.users.email, email));
  return (await loadActor(db, u!.id))!;
};
/** A seeded creator with no agreements at all: nothing blocks their erasure. */
async function idleCreator(): Promise<Actor> {
  const busy = db.select({ id: schema.agreements.creatorProfileId }).from(schema.agreements);
  const [p] = await db.select().from(schema.creatorProfiles).where(notInArray(schema.creatorProfiles.id, busy)).limit(1);
  return (await loadActor(db, p!.userId))!;
}

beforeAll(async () => {
  db = await createTestDb();
  await runJobs(db); // drain anything the seed queued
});

describe("email through the outbox", () => {
  it("notify() queues one email per recipient and the worker sends it once", async () => {
    const meera = await actorByEmail("meera@creators.demo");
    await db.transaction((tx) => notify(tx, [meera.userId, meera.userId], "Test offer", "Body text", "/creator"));
    const [n] = await db.select().from(schema.notifications).where(eq(schema.notifications.title, "Test offer"));
    const jobs = await db.select().from(schema.jobs).where(eq(schema.jobs.idempotencyKey, `email.send:${n!.id}`));
    expect(jobs).toHaveLength(1);

    await runJobs(db);
    await processEmailSend(db, n!.id); // a retry after a crash: same idempotency key, no second email
    const sent = mockOutbox.filter((m) => m.idempotencyKey === `notification:${n!.id}`);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: "meera@creators.demo", subject: "Test offer" });
    expect(sent[0]!.text).toContain("http://localhost:3000/creator");
  });

  it("escapes HTML from user-supplied text", async () => {
    const meera = await actorByEmail("meera@creators.demo");
    await notify(db, [meera.userId], "<script>x</script>", "a & b");
    await runJobs(db);
    const m = mockOutbox.at(-1)!;
    expect(m.html).not.toContain("<script>");
    expect(m.html).toContain("&lt;script&gt;");
  });

  it("a permanent provider rejection is audited and not retried", async () => {
    const meera = await actorByEmail("meera@creators.demo");
    const [n] = await db.insert(schema.notifications).values({ userId: meera.userId, title: "Bounce", body: "" }).returning();
    const rejecting: EmailProvider = { name: "test", send: async () => { throw new PermanentEmailError("422 invalid to"); } };
    await expect(processEmailSend(db, n!.id, rejecting)).resolves.toBeUndefined();
    const audits = await db.select().from(schema.auditEvents).where(and(eq(schema.auditEvents.entityId, n!.id), eq(schema.auditEvents.action, "email_rejected")));
    expect(audits).toHaveLength(1);
    const failing: EmailProvider = { name: "test", send: async () => { throw new Error("503"); } };
    await expect(processEmailSend(db, n!.id, failing)).rejects.toThrow("503");
  });
});

describe("privacy", () => {
  it("records consent at onboarding and keeps the log append-only", async () => {
    await expect(onboard(db, { subject: "user_p1", email: "p1@example.com", emailVerified: true, name: "P One", acceptedNotice: false, productEmails: false, choice: "creator", orgId: null, opsEmails: new Set() })).rejects.toThrow(/privacy notice/);
    await onboard(db, { subject: "user_p1", email: "p1@example.com", emailVerified: true, name: "P One", acceptedNotice: true, productEmails: true, choice: "creator", orgId: null, opsEmails: new Set() });
    const p1 = await actorByEmail("p1@example.com");
    const c = await privacy.currentConsents(db, p1.userId);
    expect(c.account).toMatchObject({ granted: true, noticeVersion: privacy.NOTICE_VERSION });
    expect(c.product_emails?.granted).toBe(true);
    await privacy.setProductEmails(db, p1, false);
    expect((await privacy.currentConsents(db, p1.userId)).product_emails?.granted).toBe(false);
    await expect(db.execute(sql`update consents set granted = true`)).rejects.toThrow();
    await expect(db.execute(sql`delete from consents`)).rejects.toThrow();
  });

  it("new creators are private and can't apply until their profile is complete", async () => {
    const p1 = await actorByEmail("p1@example.com");
    const [profile] = await db.select().from(schema.creatorProfiles).where(eq(schema.creatorProfiles.userId, p1.userId));
    expect(profile!.visibility).toBe("private");
    const [c] = await db.select().from(schema.campaigns).where(eq(schema.campaigns.status, "published")).limit(1);
    await expect(collab.applyToCampaign(db, p1, c!.id, { pitch: "x".repeat(40), proposedRateMinor: 100, availability: "", portfolioLinks: [] })).rejects.toThrow(/Complete your profile/);
  });

  it("export: a job builds the bundle; only its owner can download it; it expires after 7 days", async () => {
    const meera = await actorByEmail("meera@creators.demo");
    const id = await db.transaction((tx) => privacy.requestExport(tx, meera));
    await expect(db.transaction((tx) => privacy.requestExport(tx, meera))).rejects.toThrow(/already/);
    await runJobs(db);
    const bundle = (await privacy.getExport(db, meera, id)) as { user: { email: string }; creator: { socialAccounts: Record<string, unknown>[] } };
    expect(bundle.user.email).toBe("meera@creators.demo");
    expect(bundle.creator.socialAccounts.every((a) => a.tokenSecretRef === undefined)).toBe(true);

    const other = await actorByEmail("kabir@creators.demo");
    await expect(privacy.getExport(db, other, id)).rejects.toThrow(/not found/);

    await privacy.expireExports(db, new Date(Date.now() + 8 * 86_400_000));
    await expect(privacy.getExport(db, meera, id)).rejects.toThrow(/not found/);
  });

  it("erasure is blocked while money is still open, and says why", async () => {
    const meera = await actorByEmail("meera@creators.demo");
    await expect(privacy.requestErasure(db, meera, "wrong@example.com")).rejects.toThrow(DomainError);
    const id = await db.transaction((tx) => privacy.requestErasure(tx, meera, "MEERA@creators.demo"));
    await runJobs(db);
    const [r] = await db.select().from(schema.dataRequests).where(eq(schema.dataRequests.id, id));
    expect(r!.status).toBe("blocked");
    expect(r!.reason).toMatch(/collaboration/);
    expect((await loadActor(db, meera.userId))?.email).toBe("meera@creators.demo");
  });

  it("a brand's only owner must hand over ownership first", async () => {
    const aarav = await actorByEmail("aarav@glowbotanics.demo");
    const blockers = await privacy.erasureBlockers(db, aarav.userId);
    expect(blockers.join(" ")).toMatch(/only owner/);
  });

  it("erasure pseudonymises the person, deletes the identity once, and leaves money records intact", async () => {
    const who = await idleCreator();
    const ledgerBefore = (await db.execute(sql`select count(*)::int as n from ledger_entries`)) as unknown as { rows: { n: number }[] };
    const [u] = await db.select().from(schema.users).where(eq(schema.users.id, who.userId));
    const id = await db.transaction((tx) => privacy.requestErasure(tx, who, who.email));
    const deleted: string[] = [];
    await privacy.processErasure(db, id, async (s) => void deleted.push(s));
    await privacy.processErasure(db, id, async (s) => void deleted.push(s)); // retried job: no-op
    expect(deleted).toEqual([u!.authSubject]);

    const [after] = await db.select().from(schema.users).where(eq(schema.users.id, who.userId));
    expect(after).toMatchObject({ name: "Deleted user", status: "deleted", email: `deleted-${who.userId}@erased.invalid` });
    expect(await loadActor(db, who.userId)).toBeNull();
    const [profile] = await db.select().from(schema.creatorProfiles).where(eq(schema.creatorProfiles.userId, who.userId));
    expect(profile).toMatchObject({ displayName: "Deleted creator", bio: "", visibility: "private" });
    expect(await db.select().from(schema.portfolioItems).where(eq(schema.portfolioItems.creatorProfileId, profile!.id))).toHaveLength(0);
    expect(await db.select().from(schema.notifications).where(eq(schema.notifications.userId, who.userId))).toHaveLength(0);
    const ledgerAfter = (await db.execute(sql`select count(*)::int as n from ledger_entries`)) as unknown as { rows: { n: number }[] };
    expect(ledgerAfter.rows[0]!.n).toBe(ledgerBefore.rows[0]!.n);

    // Queued emails to the erased person are dropped, not sent to the pseudonymised address.
    const before = mockOutbox.length;
    await notify(db, [who.userId], "After erasure", "");
    await runJobs(db);
    expect(mockOutbox.length).toBe(before);
  });

  it("ops see open and blocked requests; others can't", async () => {
    const ritu = await actorByEmail("ritu@ops.demo");
    const rows = await privacy.openDataRequests(db, ritu);
    expect(rows.some((r) => r.r.status === "blocked")).toBe(true);
    await expect(privacy.openDataRequests(db, await actorByEmail("meera@creators.demo"))).rejects.toThrow();
  });
});
