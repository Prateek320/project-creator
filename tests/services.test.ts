import { beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { createTestDb, schema, type DB } from "@/db";
import { loadActor, type Actor } from "@/server/core";
import { getOwnedCampaign } from "@/server/core";
import * as campaigns from "@/server/campaigns";
import * as collab from "@/server/collaborations";
import * as finance from "@/server/finance";
import * as creators from "@/server/creators";
import * as admin from "@/server/admin";
import { runJobs } from "@/server/job-handlers";
import { drain } from "@/server/jobs";
import { postLedger } from "@/server/core";
import { decryptSecret, encryptSecret } from "@/server/crypto";
import { ROTATION_OVERLAP_MS, rotateWebhookSecret, verifyOrgSignature } from "@/server/webhooks";
import { rateLimit } from "@/server/rate-limit";
import { appEnv, assertDemo } from "@/server/env";
import { signPayload } from "@/domain/attribution";
import { fundingLines } from "@/domain/ledger";
import { sql } from "drizzle-orm";
import { DomainError } from "@/domain/types";

let db: DB;
const actors: Record<string, Actor> = {};
const byEmail = async (email: string) => {
  const [u] = await db.select().from(schema.users).where(eq(schema.users.email, email));
  return (await loadActor(db, u!.id))!;
};
const campaignByTitle = async (title: string) => (await db.select().from(schema.campaigns).where(eq(schema.campaigns.title, title)))[0]!;
const rootFor = async (campaignId: string, creatorProfileId: string) =>
  (
    await db
      .select()
      .from(schema.agreements)
      .where(and(eq(schema.agreements.campaignId, campaignId), eq(schema.agreements.creatorProfileId, creatorProfileId), eq(schema.agreements.version, 1)))
  )[0]!;

beforeAll(async () => {
  db = await createTestDb();
  actors.glow = await byEmail("aarav@glowbotanics.demo");
  actors.stride = await byEmail("nisha@urbanstride.demo");
  actors.meera = await byEmail("meera@creators.demo");
  actors.kabir = await byEmail("kabir@creators.demo");
  actors.sana = await byEmail("sana@creators.demo");
  actors.ops = await byEmail("ritu@ops.demo");
});

describe("tenant isolation", () => {
  it("brand B cannot read or mutate brand A's campaigns, applications or reports", async () => {
    const c = await campaignByTitle("Monsoon Glow Serum launch");
    await expect(getOwnedCampaign(db, actors.stride!, c.id)).rejects.toThrow(/not found/);
    await expect(collab.listCampaignApplications(db, actors.stride!, c.id)).rejects.toThrow(/not found/);
    await expect(finance.campaignReport(db, actors.stride!, c.id)).rejects.toThrow(/not found/);
    await expect(campaigns.transitionCampaign(db, actors.stride!, c.id, "paused")).rejects.toThrow(/not found/);
    await expect(campaigns.fundCampaign(db, actors.stride!, c.id)).rejects.toThrow(/not found/);
    const [app] = await db.select().from(schema.applications).where(eq(schema.applications.campaignId, c.id));
    await expect(collab.setApplicationStatus(db, actors.stride!, app!.id, "rejected")).rejects.toThrow(/not found/);
  });

  it("a creator cannot open another creator's collaboration or settlement", async () => {
    const c = await campaignByTitle("Monsoon Glow Serum launch");
    const root = await rootFor(c.id, actors.meera!.creatorProfileId!);
    await expect(collab.getCollaboration(db, actors.kabir!, root.id)).rejects.toThrow(/not found/);
    await expect(finance.getSettlement(db, actors.sana!, root.id)).rejects.toThrow(/not found/);
    await expect(finance.creatorEarnings(db, actors.glow!)).rejects.toThrow();
  });

  it("brand webhook events for another tenant's campaign are rejected", async () => {
    const c = await campaignByTitle("Monsoon Glow Serum launch");
    const [stride] = await db.select().from(schema.organizations).where(eq(schema.organizations.displayName, "Urban Stride"));
    const res = await finance.ingestEvents(db, stride!.id, [
      { event_id: "cross-tenant-1", campaign_id: c.id, creator_id: actors.meera!.creatorProfileId, event_type: "signup", occurred_at: new Date().toISOString() },
    ], "brand_webhook");
    expect(res.accepted).toBe(0);
    expect(res.rejected[0]?.reason).toMatch(/Unknown campaign/);
  });

  it("role checks are enforced server-side", async () => {
    const c = await campaignByTitle("Sunscreen UGC pack");
    await expect(campaigns.transitionCampaign(db, actors.meera!, c.id, "paused")).rejects.toThrow(/brand/);
    await expect(admin.adminQueue(db, actors.glow!)).rejects.toThrow(/operations/);
    await expect(collab.applyToCampaign(db, actors.glow!, c.id, { pitch: "x".repeat(40), proposedRateMinor: 1, availability: "", portfolioLinks: [] })).rejects.toThrow(/creators/);
  });
});

describe("end-to-end vertical slice", () => {
  it("publish → apply → offer → accept → deliver → evidence → settle → payout → complete", async () => {
    const now = Date.now();
    const c = await campaigns.createCampaign(
      db,
      actors.glow!,
      {
        title: "Test hybrid campaign",
        brief: "A brief long enough to pass validation rules.",
        objective: "signups",
        niche: "Beauty",
        channels: ["Instagram"],
        audience: { locations: ["Pan-India"], ageRange: "18–34", languages: ["English"], minFollowers: 0 },
        budgetMinor: 1_000_000,
        creatorSlots: 1,
        compensation: { model: "hybrid", currency: "INR", baseFeeMinor: 300_000, ratePerOutcomeMinor: 7_000, capMinor: 1_000_000, outcomeEvent: "signup", attributionWindowDays: 7, partialDeliverablePolicy: "all_or_nothing", exclusions: "" },
        measurement: { primaryMetric: "Signups", target: 100, sourceOfTruth: "brand_webhook", validDefinition: "Verified email" },
        rights: "90 days organic",
        landingUrl: "https://example.com",
        startAt: new Date(now - 86_400_000),
        endAt: new Date(now + 5 * 86_400_000),
        applyBy: null,
        visibility: "public",
        requirements: [{ channel: "Instagram", deliverableType: "Reel", quantity: 1, dueOffsetDays: 2, acceptanceCriteria: "" }],
      },
      true,
    );
    await campaigns.fundCampaign(db, actors.glow!, c.id);
    await campaigns.fundCampaign(db, actors.glow!, c.id); // idempotent
    // Requesting funding only queues it: nothing reaches the ledger until the job runs.
    expect((await getOwnedCampaign(db, actors.glow!, c.id)).fundingState).toBe("funding_pending");
    await runJobs(db);
    await runJobs(db); // nothing left to do
    expect((await getOwnedCampaign(db, actors.glow!, c.id)).fundingState).toBe("funded");
    const funding = await db.select().from(schema.ledgerEntries).where(and(eq(schema.ledgerEntries.campaignId, c.id), eq(schema.ledgerEntries.entryType, "funding")));
    expect(funding).toHaveLength(2);

    const app = await collab.applyToCampaign(db, actors.sana!, c.id, { pitch: "I would love to do this campaign for my audience.", proposedRateMinor: 300_000, availability: "now", portfolioLinks: [] });
    await expect(collab.applyToCampaign(db, actors.sana!, c.id, { pitch: "I would love to do this campaign for my audience.", proposedRateMinor: 300_000, availability: "now", portfolioLinks: [] })).rejects.toThrow(/already applied/);
    const offer = await collab.makeOffer(db, actors.glow!, app.id, { formula: c.compensation });
    // Not active until the creator accepts.
    expect((await collab.getCollaboration(db, actors.sana!, offer.id)).active).toBeNull();
    await collab.acceptAgreement(db, actors.sana!, offer.id);
    const live = await collab.getCollaboration(db, actors.sana!, offer.id);
    expect(live.active?.status).toBe("accepted");
    expect(live.deliverables).toHaveLength(1);

    const d = live.deliverables[0]!;
    await expect(collab.reviewDeliverable(db, actors.glow!, d.id, "approved", "")).rejects.toThrow(/cannot move/);
    await collab.submitDeliverable(db, actors.sana!, d.id, "https://instagram.com/p/x", "");
    await collab.reviewDeliverable(db, actors.glow!, d.id, "approved", "");

    const evs = Array.from({ length: 10 }, (_, i) => ({ event_id: `slice-${i}`, campaign_id: c.id, creator_id: actors.sana!.creatorProfileId, event_type: "signup", occurred_at: new Date(now - 3_600_000).toISOString() }));
    const first = await finance.ingestEvents(db, actors.glow!.orgId!, evs, "brand_webhook");
    const replay = await finance.ingestEvents(db, actors.glow!.orgId!, evs, "brand_webhook");
    expect(first.accepted).toBe(10);
    expect(replay).toMatchObject({ accepted: 0, duplicates: 10 });

    const s = await finance.getSettlement(db, actors.glow!, offer.id);
    expect(s.result.totalMinor).toBe(300_000 + 10 * 7_000);
    await finance.approveSettlement(db, actors.glow!, offer.id);
    await expect(finance.approveSettlement(db, actors.glow!, offer.id)).rejects.toThrow(/up to date/);
    await finance.payoutCreator(db, actors.glow!, offer.id);
    await expect(finance.payoutCreator(db, actors.glow!, offer.id)).rejects.toThrow(/already processing/);
    expect((await finance.getSettlement(db, actors.sana!, offer.id)).balances.creator_paid).toBe(0);
    await runJobs(db);
    const after = await finance.getSettlement(db, actors.sana!, offer.id);
    expect(after.balances.creator_paid).toBe(370_000);
    expect(after.balances.creator_payable).toBe(0);
    await finance.completeCollaboration(db, actors.glow!, offer.id);
    expect((await collab.getCollaboration(db, actors.glow!, offer.id)).active?.status).toBe("completed");
  });
});

describe("agreements", () => {
  it("amendments need both parties; settlement uses the accepted version only", async () => {
    const c = await campaignByTitle("Monsoon Glow Serum launch");
    const root = await rootFor(c.id, actors.meera!.creatorProfileId!);
    const before = await finance.getSettlement(db, actors.glow!, root.id);
    const amended = { ...before.formula, ratePerOutcomeMinor: 9_000 };
    const v2 = await collab.proposeAmendment(db, actors.meera!, root.id, { formula: amended, shiftDueDays: 0, summary: "Raise per-signup rate after strong week one" });
    expect(v2.version).toBe(2);
    const pending = await finance.getSettlement(db, actors.glow!, root.id);
    expect(pending.formula.ratePerOutcomeMinor).toBe(7_000); // still v1
    await expect(collab.acceptAgreement(db, actors.kabir!, v2.id)).rejects.toThrow(/not found/);
    await collab.acceptAgreement(db, actors.glow!, v2.id);
    const accepted = await collab.getCollaboration(db, actors.glow!, root.id);
    expect(accepted.active?.version).toBe(2);
    expect(accepted.versions.find((v) => v.version === 1)?.status).toBe("superseded");
    // The superseded snapshot is never edited.
    expect(accepted.versions.find((v) => v.version === 1)?.formulaSnapshot.ratePerOutcomeMinor).toBe(7_000);
  });

  it("revision rounds are limited by the agreement", async () => {
    const c = await campaignByTitle("Monsoon Glow Serum launch");
    const root = await rootFor(c.id, actors.meera!.creatorProfileId!);
    const { deliverables } = await collab.getCollaboration(db, actors.glow!, root.id);
    const d = deliverables.find((x) => x.approvalState === "submitted")!;
    await collab.reviewDeliverable(db, actors.glow!, d.id, "changes_requested", "Please re-cut the hook");
    await collab.submitDeliverable(db, actors.meera!, d.id, "https://instagram.com/p/y", "");
    await collab.reviewDeliverable(db, actors.glow!, d.id, "changes_requested", "One more pass on the caption");
    await collab.submitDeliverable(db, actors.meera!, d.id, "https://instagram.com/p/z", "");
    await expect(collab.reviewDeliverable(db, actors.glow!, d.id, "changes_requested", "And again please")).rejects.toThrow(/revision rounds/);
  });
});

describe("ledger integrity & disputes", () => {
  it("ledger rows are append-only at the database level", async () => {
    const [row] = await db.select().from(schema.ledgerEntries).limit(1);
    await expect(db.update(schema.ledgerEntries).set({ amountMinor: 1 }).where(eq(schema.ledgerEntries.id, row!.id))).rejects.toThrow();
    await expect(db.delete(schema.ledgerEntries).where(eq(schema.ledgerEntries.id, row!.id))).rejects.toThrow();
  });

  it("every transaction group balances", async () => {
    const rows = await db.select().from(schema.ledgerEntries);
    const sums = new Map<string, number>();
    for (const r of rows) sums.set(r.transactionGroupId, (sums.get(r.transactionGroupId) ?? 0) + r.amountMinor);
    for (const v of sums.values()) expect(v).toBe(0);
  });

  it("dispute holds only the disputed portion; resolution requires a reason and is audited", async () => {
    const c = await campaignByTitle("10K Steps Challenge");
    const root = await rootFor(c.id, actors.kabir!.creatorProfileId!);
    const s = await finance.getSettlement(db, actors.stride!, root.id);
    expect(s.balances.dispute_hold).toBe(150_000);
    expect(s.balances.creator_payable).toBe(150_000);
    const d = s.openDispute!;
    await expect(finance.resolveDispute(db, actors.stride!, d.id, { creatorShareMinor: 0, reason: "brand tries", outcome: "rejected" })).rejects.toThrow();
    await expect(finance.resolveDispute(db, actors.ops!, d.id, { creatorShareMinor: 0, reason: "short", outcome: "upheld" })).rejects.toThrow(/reason/);
    await finance.resolveDispute(db, actors.ops!, d.id, { creatorShareMinor: 50_000, reason: "Returns confirmed for 10 orders via brand OMS export", outcome: "split" });
    const after = await finance.getSettlement(db, actors.stride!, root.id);
    expect(after.balances.dispute_hold).toBe(0);
    expect(after.balances.creator_payable).toBe(200_000);
    expect(after.collab.active?.status).toBe("accepted");
    // Returned-to-campaign amount can't be re-approved.
    expect(after.pendingApprovalMinor).toBe(0);
    const trail = await db.select().from(schema.auditEvents).where(and(eq(schema.auditEvents.entityId, d.id), eq(schema.auditEvents.action, "resolved")));
    expect(trail[0]?.reason).toMatch(/Returns confirmed/);
  });

  it("reversing a payout appends compensating entries", async () => {
    const [t] = await db.select().from(schema.paymentTransfers).where(eq(schema.paymentTransfers.state, "paid")).limit(1);
    const before = await db.select().from(schema.ledgerEntries).where(eq(schema.ledgerEntries.agreementId, t!.agreementId));
    await expect(finance.reverseTransfer(db, actors.glow!, t!.id, "brand cannot")).rejects.toThrow();
    await finance.reverseTransfer(db, actors.ops!, t!.id, "Bank returned the transfer");
    await finance.reverseTransfer(db, actors.ops!, t!.id, "Bank returned the transfer").catch((e) => expect(e).toBeInstanceOf(DomainError));
    const after = await db.select().from(schema.ledgerEntries).where(eq(schema.ledgerEntries.agreementId, t!.agreementId));
    expect(after.length).toBe(before.length + 2);
  });
});

describe("creator data", () => {
  it("disconnecting an account marks its metrics stale", async () => {
    const [acct] = await db.select().from(schema.socialAccounts).where(eq(schema.socialAccounts.creatorProfileId, actors.sana!.creatorProfileId!));
    await creators.disconnectAccount(db, actors.sana!, acct!.id);
    await expect(creators.disconnectAccount(db, actors.meera!, acct!.id)).rejects.toThrow(/not found/);
    const ms = await db.select().from(schema.metricSnapshots).where(eq(schema.metricSnapshots.socialAccountId, acct!.id));
    expect(ms.every((m) => m.verificationStatus === "stale")).toBe(true);
    const [a] = await db.select().from(schema.socialAccounts).where(eq(schema.socialAccounts.id, acct!.id));
    expect(a?.tokenSecretRef).toBeNull();
  });

  it("discovery filters run server-side with cursor pagination", async () => {
    const page1 = await creators.discoverCreators(db, { limit: 5 });
    expect(page1.items.length).toBe(5);
    expect(page1.nextCursor).toBeTruthy();
    const page2 = await creators.discoverCreators(db, { cursor: page1.nextCursor!, limit: 5 });
    const ids = new Set([...page1.items, ...page2.items].map((i) => i.profile.id));
    expect(ids.size).toBe(page1.items.length + page2.items.length);
    const beauty = await creators.discoverCreators(db, { niche: "Beauty" });
    expect(beauty.items.every((i) => i.profile.niches.includes("Beauty"))).toBe(true);
    const camp = await campaigns.discoverCampaigns(db, { niche: "Fitness" });
    expect(camp.items.every((i) => i.campaign.niche === "Fitness" && i.campaign.status === "published")).toBe(true);
  });
});

describe("jobs and outbox", () => {
  const jobRows = async (kind: string) => (await db.select().from(schema.jobs).where(eq(schema.jobs.kind, kind)));

  it("a payout survives a worker crash: reclaimed job settles exactly once and the ledger balances", async () => {
    const c = await campaignByTitle("Monsoon Glow Serum launch");
    const root = await rootFor(c.id, actors.meera!.creatorProfileId!);
    await finance.approveSettlement(db, actors.glow!, root.id);
    await finance.payoutCreator(db, actors.glow!, root.id);
    const [pending] = (await finance.getSettlement(db, actors.glow!, root.id)).transfers.filter((t) => t.state === "transfer_pending");
    expect(pending).toBeDefined();
    // Simulate a worker that claimed the job and died: running, locked six minutes ago.
    await db.update(schema.jobs).set({ status: "running", lockedAt: new Date(Date.now() - 6 * 60_000), lockedBy: "dead-worker", attempts: 1 })
      .where(eq(schema.jobs.idempotencyKey, `payout.transfer:${pending!.id}`));
    await runJobs(db);
    await finance.processPayoutTransfer(db, pending!.id); // a duplicate run is a no-op
    const s = await finance.getSettlement(db, actors.glow!, root.id);
    expect(s.transfers.filter((t) => t.state === "paid" && t.id === pending!.id)).toHaveLength(1);
    expect(s.balances.creator_payable).toBe(0);
    const payoutLinesForTransfer = s.entries.filter((e) => e.entryType === "payout" && e.referenceId === s.transfers.find((t) => t.id === pending!.id)!.providerRef);
    expect(payoutLinesForTransfer).toHaveLength(2);
    expect(payoutLinesForTransfer.reduce((t, e) => t + e.amountMinor, 0)).toBe(0);
  });

  it("failing jobs back off, then go dead with an audit row", async () => {
    await db.insert(schema.jobs).values({ kind: "maintenance.prune", idempotencyKey: "test:always-fails", maxAttempts: 2 });
    const failing = { "payout.transfer": async () => {}, "funding.collect": async () => {}, "maintenance.prune": async () => { throw new Error("boom"); } };
    const first = await drain(db, failing);
    expect(first.retried).toBeGreaterThanOrEqual(1);
    const [afterFirst] = await db.select().from(schema.jobs).where(eq(schema.jobs.idempotencyKey, "test:always-fails"));
    expect(afterFirst).toMatchObject({ status: "queued", attempts: 1, lastError: "boom" });
    expect(afterFirst!.runAt.getTime()).toBeGreaterThan(Date.now());
    await db.update(schema.jobs).set({ runAt: new Date(0) }).where(eq(schema.jobs.idempotencyKey, "test:always-fails"));
    await drain(db, failing);
    const [dead] = await db.select().from(schema.jobs).where(eq(schema.jobs.idempotencyKey, "test:always-fails"));
    expect(dead!.status).toBe("dead");
    const audits = await db.select().from(schema.auditEvents).where(and(eq(schema.auditEvents.entityId, dead!.id), eq(schema.auditEvents.action, "job_dead")));
    expect(audits).toHaveLength(1);
    expect(await jobRows("maintenance.prune")).not.toHaveLength(0);
  });

  it("concurrent postLedger calls with one key write one balanced group", async () => {
    const c = await campaignByTitle("Monsoon Glow Serum launch");
    const p = { idempotencyKey: "test:concurrent", campaignId: c.id, entryType: "funding" as const, lines: fundingLines(1_000), referenceType: "test", referenceId: "t", memo: "concurrency test" };
    const [a, b] = await Promise.all([postLedger(db, p), postLedger(db, p)]);
    expect([a.written, b.written].sort()).toEqual([false, true]);
    expect(a.groupId).toBe(b.groupId);
    const rows = await db.select().from(schema.ledgerEntries).where(eq(schema.ledgerEntries.transactionGroupId, a.groupId));
    expect(rows).toHaveLength(2);
  });
});

describe("security foundations", () => {
  it("encrypts secrets with authentication", () => {
    const stored = encryptSecret("hello");
    expect(stored).toMatch(/^v1:/);
    expect(stored).not.toContain("hello");
    expect(decryptSecret(stored)).toBe("hello");
    const [v, iv, tag, ct] = stored.split(":");
    const flipped = `${v}:${iv}:${tag}:${ct!.slice(0, -2)}${ct!.endsWith("A") ? "B" : "A"}${ct!.slice(-1)}`;
    expect(() => decryptSecret(flipped)).toThrow();
  });

  it("rotating a webhook secret keeps the old one valid for 24 hours only", async () => {
    const first = await rotateWebhookSecret(db, actors.glow!);
    const second = await rotateWebhookSecret(db, actors.glow!);
    const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, actors.glow!.orgId!));
    expect(org!.webhookSecretEnc).not.toContain(second);
    const body = JSON.stringify({ event_id: "rotation" });
    const sig = (secret: string) => `sha256=${signPayload(secret, body)}`;
    expect(verifyOrgSignature(org!, body, sig(second))).toBe(true);
    expect(verifyOrgSignature(org!, body, sig(first))).toBe(true);
    const later = new Date(org!.webhookSecretRotatedAt!.getTime() + ROTATION_OVERLAP_MS + 1);
    expect(verifyOrgSignature(org!, body, sig(first), later)).toBe(false);
    expect(verifyOrgSignature(org!, body, sig(second), later)).toBe(true);
    expect(verifyOrgSignature(org!, body, sig("wrong"))).toBe(false);
  });

  it("rate limits per key across a fixed window", async () => {
    expect(await rateLimit(db, "test:rl", 2, 60_000)).toBe(true);
    expect(await rateLimit(db, "test:rl", 2, 60_000)).toBe(true);
    expect(await rateLimit(db, "test:rl", 2, 60_000)).toBe(false);
    await db.execute(sql`update rate_limits set window_start = now() - interval '2 minutes' where key = 'test:rl'`);
    expect(await rateLimit(db, "test:rl", 2, 60_000)).toBe(true);
  });

  it("demo-only behaviour is unavailable outside the demo, and APP_ENV is required with a real database", () => {
    const saved = { APP_ENV: process.env.APP_ENV, DATABASE_URL: process.env.DATABASE_URL };
    try {
      process.env.APP_ENV = "staging";
      expect(() => assertDemo()).toThrow(/Not found/);
      delete process.env.APP_ENV;
      process.env.DATABASE_URL = "postgres://example/db";
      expect(() => appEnv()).toThrow(/APP_ENV must be set/);
    } finally {
      for (const [k, v] of Object.entries(saved)) if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  });
});
