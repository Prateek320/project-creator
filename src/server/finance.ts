/** Attribution ingest, settlement evaluation, ledger, payouts and disputes. */
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import * as schema from "@/db/schema";
import { parseEvent } from "@/domain/attribution";
import { evaluateSettlement } from "@/domain/compensation";
import {
  balances,
  payoutLines,
  refundLines,
  releaseHoldLines,
  reversalLines,
  settlementLines,
  type LedgerLine,
} from "@/domain/ledger";
import { DomainError } from "@/domain/types";
import { formatINR } from "@/domain/money";
import { getCollaboration } from "./collaborations";
import {
  assertUuid,
  audit,
  brandUserIds,
  creatorUserId,
  ForbiddenError,
  getOwnedCampaign,
  ledgerFor,
  NotFoundError,
  notify,
  postLedger,
  requireAdmin,
  requireBrand,
  type Actor,
  type Executor,
} from "./core";
import { getPaymentProvider } from "./providers";

const { attributionEvents, agreements, campaigns, ledgerEntries, paymentTransfers, disputes, milestones, creatorProfiles, organizations } =
  schema;

// ---------------- attribution ----------------

export interface IngestResult {
  accepted: number;
  duplicates: number;
  rejected: { index: number; reason: string }[];
}

/**
 * Ingests brand-side conversion events for one organisation (tenant).
 * Duplicate event_ids are counted once (unique constraint + ON CONFLICT DO NOTHING).
 */
export async function ingestEvents(db: Executor, orgId: string, rawEvents: unknown[], source: string): Promise<IngestResult> {
  const result: IngestResult = { accepted: 0, duplicates: 0, rejected: [] };
  if (rawEvents.length > 1000) throw new DomainError("Send at most 1,000 events per request");
  const cache = new Map<string, { campaign: typeof campaigns.$inferSelect; hasAgreement: boolean } | null>();
  for (const [index, raw] of rawEvents.entries()) {
    try {
      const e = parseEvent(raw);
      if (!/^[0-9a-f-]{36}$/i.test(e.campaign_id) || !/^[0-9a-f-]{36}$/i.test(e.creator_id)) throw new DomainError("Unknown campaign or creator");
      const key = `${e.campaign_id}|${e.creator_id}`;
      let ctx = cache.get(key);
      if (ctx === undefined) {
        const [c] = await db.select().from(campaigns).where(eq(campaigns.id, e.campaign_id));
        const [ag] =
          c && c.organizationId === orgId
            ? await db
                .select({ id: agreements.id })
                .from(agreements)
                .where(
                  and(
                    eq(agreements.campaignId, c.id),
                    eq(agreements.creatorProfileId, e.creator_id),
                    sql`${agreements.status} in ('accepted','disputed','completed','superseded')`,
                  ),
                )
                .limit(1)
            : [];
        ctx = c && c.organizationId === orgId ? { campaign: c, hasAgreement: Boolean(ag) } : null;
        cache.set(key, ctx);
      }
      if (!ctx) throw new DomainError("Unknown campaign or creator");
      if (!ctx.hasAgreement) throw new DomainError("Creator has no accepted agreement on this campaign");
      const c = ctx.campaign;
      const occurred = new Date(e.occurred_at);
      const validity = e.test ? "test" : occurred < c.startAt ? "out_of_window" : "valid";
      const inserted = await db
        .insert(attributionEvents)
        .values({
          eventId: e.event_id,
          campaignId: c.id,
          creatorProfileId: e.creator_id,
          eventType: e.event_type,
          occurredAt: occurred,
          valueMinor: e.value_minor ?? 0,
          currency: e.currency ?? "INR",
          source: e.source === "brand_webhook" ? source : (e.source ?? source),
          validityState: validity,
          reasonCode: validity === "out_of_window" ? "before_campaign_start" : validity === "test" ? "test_event" : null,
        })
        .onConflictDoNothing({ target: attributionEvents.eventId })
        .returning({ id: attributionEvents.id });
      if (inserted.length === 0) result.duplicates++;
      else result.accepted++;
    } catch (err) {
      result.rejected.push({ index, reason: err instanceof Error ? err.message : "Invalid event" });
    }
  }
  return result;
}

/** First-party tracked-link click. Repeat clicks from the same visitor within a minute are deduplicated. */
export async function recordClick(db: Executor, slug: string, visitorFingerprint: string) {
  if (!/^[a-z0-9]{4,16}$/.test(slug)) return null;
  const [row] = await db
    .select({ agreement: agreements, campaign: campaigns })
    .from(agreements)
    .innerJoin(campaigns, eq(agreements.campaignId, campaigns.id))
    .where(and(eq(agreements.trackingSlug, slug), sql`${agreements.status} in ('accepted','disputed','completed')`))
    .limit(1);
  if (!row) return null;
  const bucket = Math.floor(Date.now() / 60_000);
  const eventId = `click:${slug}:${createHash("sha256").update(`${visitorFingerprint}|${bucket}`).digest("hex").slice(0, 24)}`;
  await db
    .insert(attributionEvents)
    .values({
      eventId,
      campaignId: row.campaign.id,
      creatorProfileId: row.agreement.creatorProfileId,
      eventType: "click",
      occurredAt: new Date(),
      source: "first_party_link",
      validityState: row.campaign.status === "published" || row.campaign.status === "paused" ? "valid" : "out_of_window",
    })
    .onConflictDoNothing({ target: attributionEvents.eventId });
  const url = new URL(row.campaign.landingUrl);
  url.searchParams.set("utm_source", "proovd");
  url.searchParams.set("utm_campaign", slug);
  url.searchParams.set("pc_campaign", row.campaign.id);
  url.searchParams.set("pc_creator", row.agreement.creatorProfileId);
  return url.toString();
}

/** Demo helper: sends conversions through the same ingest path a brand webhook uses. */
export async function simulateConversions(db: Executor, actor: Actor, rootAgreementId: string, count: number) {
  requireBrand(actor);
  const collab = await getCollaboration(db, actor, rootAgreementId);
  if (collab.side !== "brand") throw new ForbiddenError();
  const f = collab.active?.formulaSnapshot;
  if (!f) throw new DomainError("Accept the agreement before recording outcomes");
  const n = Math.min(Math.max(Math.floor(count), 1), 200);
  const type = f.outcomeEvent ?? "signup";
  const now = Date.now();
  const events = Array.from({ length: n }, (_, i) => ({
    event_id: `demo-${crypto.randomUUID()}`,
    campaign_id: collab.campaign.id,
    creator_id: collab.creator.id,
    event_type: type,
    occurred_at: new Date(Math.min(now, Math.max(collab.campaign.startAt.getTime() + 3_600_000, now - i * 3_600_000))).toISOString(),
    value_minor: type === "sale" ? 149_900 : 0,
  }));
  // Replay the first event to demonstrate idempotent ingestion.
  const replay = events[0] ? [events[0]] : [];
  const res = await ingestEvents(db, actor.orgId, [...events, ...replay], "demo_simulator");
  await audit(db, actor, "campaign", collab.campaign.id, "demo_events_simulated", { ...res });
  return res;
}

export async function setEventValidity(db: Executor, actor: Actor, eventRowId: string, to: "invalid" | "valid", reason: string) {
  assertUuid(eventRowId, "Event");
  if (reason.trim().length < 5) throw new DomainError("A reason is required for manual overrides");
  const [ev] = await db.select().from(attributionEvents).where(eq(attributionEvents.id, eventRowId));
  if (!ev) throw new NotFoundError("Event");
  if (actor.role === "brand") await getOwnedCampaign(db, actor, ev.campaignId);
  else requireAdmin(actor);
  if (ev.validityState === "duplicate" || ev.validityState === "test") throw new DomainError("Duplicate and test events can't be changed");
  await db.update(attributionEvents).set({ validityState: to, reasonCode: to === "invalid" ? "manual_override" : null }).where(eq(attributionEvents.id, ev.id));
  await audit(db, actor, "attribution_event", ev.id, `marked_${to}`, { eventId: ev.eventId, from: ev.validityState }, reason);
}

// ---------------- settlement ----------------

export async function getSettlement(db: Executor, actor: Actor, rootAgreementId: string) {
  const collab = await getCollaboration(db, actor, rootAgreementId);
  const events = await db
    .select()
    .from(attributionEvents)
    .where(and(eq(attributionEvents.campaignId, collab.campaign.id), eq(attributionEvents.creatorProfileId, collab.creator.id)))
    .orderBy(desc(attributionEvents.occurredAt));
  const entries = await ledgerFor(db, { agreementId: collab.root.id });
  const bal = balances(entries);
  // Net amount committed out of campaign funds for this agreement. Amounts returned to the campaign by a
  // dispute resolution count as resolved (not owed), so they can't be re-approved.
  const settledToDate = -entries
    .filter((e) => e.account === "campaign_funds" && e.entryType !== "dispute_release")
    .reduce((sum, e) => sum + e.amountMinor, 0);
  const formula = collab.active?.formulaSnapshot ?? collab.pending?.formulaSnapshot ?? collab.root.formulaSnapshot;
  const result = evaluateSettlement({
    formula,
    deliverables: collab.deliverables,
    events: events.map((e) => ({ eventId: e.eventId, eventType: e.eventType, occurredAt: e.occurredAt, validityState: e.validityState })),
    window: { start: collab.campaign.startAt, end: collab.campaign.endAt },
  });
  const transfers = await db.select().from(paymentTransfers).where(eq(paymentTransfers.agreementId, collab.root.id)).orderBy(asc(paymentTransfers.createdAt));
  const [openDispute] = await db
    .select()
    .from(disputes)
    .where(and(eq(disputes.agreementId, collab.root.id), sql`${disputes.state} in ('open','under_review')`))
    .limit(1);
  const allDisputes = await db.select().from(disputes).where(eq(disputes.agreementId, collab.root.id)).orderBy(desc(disputes.createdAt));
  return {
    collab,
    formula,
    events,
    result,
    entries,
    balances: bal,
    settledToDate,
    pendingApprovalMinor: result.totalMinor - settledToDate,
    transfers,
    openDispute: openDispute ?? null,
    disputes: allDisputes,
  };
}

async function campaignFundsAvailable(db: Executor, campaignId: string) {
  const [r] = await db
    .select({ total: sql<string>`coalesce(sum(${ledgerEntries.amountMinor}), 0)` })
    .from(ledgerEntries)
    .where(and(eq(ledgerEntries.campaignId, campaignId), eq(ledgerEntries.account, "campaign_funds")));
  return Number(r?.total ?? 0);
}

/** Brand approves the amount earned so far. Incremental and idempotent: never double-counts. */
export async function approveSettlement(db: Executor, actor: Actor, rootAgreementId: string) {
  requireBrand(actor);
  const s = await getSettlement(db, actor, rootAgreementId);
  const { collab } = s;
  if (collab.side !== "brand") throw new ForbiddenError();
  if (!collab.active) throw new DomainError("There's no accepted agreement to settle");
  if (collab.campaign.fundingState !== "funded") throw new DomainError("Fund the campaign before approving settlements");
  const delta = s.pendingApprovalMinor;
  if (delta === 0) throw new DomainError("Nothing new to approve — settlement is up to date");
  if (delta < 0)
    throw new DomainError("Earned amount is now lower than what was already approved. Open a dispute so operations can review a reversal.");
  const available = await campaignFundsAvailable(db, collab.campaign.id);
  if (available < delta) throw new DomainError("Not enough campaign funds remaining for this approval");
  const heldAlready = s.balances.dispute_hold;
  const holdTarget = s.openDispute ? s.openDispute.amountHeldMinor : 0;
  const held = Math.max(0, Math.min(delta, holdTarget - heldAlready));
  const payable = delta - held;

  await db.transaction(async (tx) => {
    const { written } = await postLedger(tx, {
      idempotencyKey: `settle:${collab.root.id}:v${collab.active!.version}:${s.result.totalMinor}`,
      campaignId: collab.campaign.id,
      agreementId: collab.root.id,
      creatorProfileId: collab.creator.id,
      entryType: "settlement",
      lines: settlementLines(payable, held),
      referenceType: "agreement_version",
      referenceId: String(collab.active!.version),
      memo: `Settlement approved against agreement v${collab.active!.version} (total earned ${formatINR(s.result.totalMinor)})`,
    });
    if (!written) return;
    const delivered = s.result.deliverablesTotal > 0 && s.result.deliverablesApproved === s.result.deliverablesTotal;
    for (const m of collab.milestones) {
      const state =
        m.milestoneType === "deliverable"
          ? delivered
            ? "earned"
            : s.result.deliverablesApproved > 0
              ? "partially_earned"
              : "pending"
          : s.result.validOutcomes > 0
            ? "earned"
            : "not_earned";
      const earned = m.milestoneType === "deliverable" ? s.result.deliverablePortionMinor : s.result.outcomePortionMinor;
      await tx.update(milestones).set({ state, earnedMinor: earned, evaluatedAt: new Date() }).where(eq(milestones.id, m.id));
    }
    await audit(tx, actor, "agreement", collab.root.id, "settlement_approved", {
      totalMinor: s.result.totalMinor,
      deltaMinor: delta,
      heldMinor: held,
      version: collab.active!.version,
    });
    await notify(tx, [await creatorUserId(tx, collab.creator.id)], "Earnings approved", `${collab.campaign.title}: settlement approved`, `/collaborations/${collab.root.id}/settlement`);
  });
}

/** Pays out the creator's approved, undisputed balance via the payment provider adapter. */
export async function payoutCreator(db: Executor, actor: Actor, rootAgreementId: string) {
  if (actor.role !== "brand" && actor.role !== "admin") throw new ForbiddenError();
  const s = await getSettlement(db, actor, rootAgreementId);
  const amount = s.balances.creator_payable;
  if (amount <= 0) throw new DomainError("No approved balance to pay out");
  const lastSettle = [...s.entries].reverse().find((e) => e.account === "creator_payable" && e.amountMinor > 0);
  const priorAttempts = s.transfers.filter((t) => t.ledgerTransactionGroupId === lastSettle?.transactionGroupId).length;
  const idempotencyKey = `payout:${s.collab.root.id}:${lastSettle?.transactionGroupId ?? "none"}:${priorAttempts}`;
  const provider = getPaymentProvider();
  const res = await provider.transfer({ idempotencyKey, amountMinor: amount, currency: "INR", destination: `creator:${s.collab.creator.id}` });
  await db.transaction(async (tx) => {
    const existing = await tx.select().from(paymentTransfers).where(eq(paymentTransfers.providerRef, res.providerRef));
    if (existing.length > 0) return; // retried request, provider already processed
    await tx.insert(paymentTransfers).values({
      provider: provider.name,
      providerRef: res.providerRef,
      idempotencyKey,
      ledgerTransactionGroupId: lastSettle?.transactionGroupId ?? crypto.randomUUID(),
      agreementId: s.collab.root.id,
      amountMinor: amount,
      state: res.status === "paid" ? "paid" : "failed",
    });
    if (res.status === "paid") {
      await postLedger(tx, {
        idempotencyKey: `payout-ledger:${res.providerRef}`,
        campaignId: s.collab.campaign.id,
        agreementId: s.collab.root.id,
        creatorProfileId: s.collab.creator.id,
        entryType: "payout",
        lines: payoutLines(amount),
        referenceType: "provider_transfer",
        referenceId: res.providerRef,
        memo: `Payout via ${provider.name} provider (test mode)`,
      });
    }
    await audit(tx, actor, "agreement", s.collab.root.id, res.status === "paid" ? "payout_paid" : "payout_failed", { amountMinor: amount, providerRef: res.providerRef });
    await notify(tx, [await creatorUserId(tx, s.collab.creator.id)], res.status === "paid" ? "Payout sent" : "Payout failed", `${s.collab.campaign.title}`, `/collaborations/${s.collab.root.id}/settlement`);
  });
}

export async function reverseTransfer(db: Executor, actor: Actor, transferId: string, reason: string) {
  requireAdmin(actor);
  assertUuid(transferId, "Transfer");
  if (reason.trim().length < 5) throw new DomainError("A reason is required");
  const [t] = await db.select().from(paymentTransfers).where(eq(paymentTransfers.id, transferId));
  if (!t) throw new NotFoundError("Transfer");
  if (t.state !== "paid") throw new DomainError("Only paid transfers can be reversed");
  const [ag] = await db.select().from(agreements).where(eq(agreements.id, t.agreementId));
  await db.transaction(async (tx) => {
    await tx.update(paymentTransfers).set({ state: "reversed" }).where(eq(paymentTransfers.id, t.id));
    await postLedger(tx, {
      idempotencyKey: `reverse:${t.id}`,
      campaignId: ag!.campaignId,
      agreementId: t.agreementId,
      creatorProfileId: ag!.creatorProfileId,
      entryType: "reversal",
      lines: reversalLines(payoutLines(t.amountMinor)),
      referenceType: "provider_transfer",
      referenceId: t.providerRef,
      memo: `Compensating entry: transfer ${t.providerRef} reversed`,
    });
    await audit(tx, actor, "payment_transfer", t.id, "reversed", { amountMinor: t.amountMinor }, reason);
  });
}

export async function completeCollaboration(db: Executor, actor: Actor, rootAgreementId: string) {
  requireBrand(actor);
  const s = await getSettlement(db, actor, rootAgreementId);
  const active = s.collab.active;
  if (!active || active.status !== "accepted") throw new DomainError("Only an active, undisputed collaboration can be completed");
  if (s.collab.deliverables.some((d) => d.approvalState !== "approved" && d.approvalState !== "rejected"))
    throw new DomainError("Review every deliverable before completing");
  if (s.pendingApprovalMinor !== 0) throw new DomainError("Approve the outstanding settlement first");
  if (s.balances.creator_payable !== 0) throw new DomainError("Pay out the approved balance first");
  await db.update(agreements).set({ status: "completed" }).where(eq(agreements.id, active.id));
  await audit(db, actor, "agreement", s.collab.root.id, "completed");
}

/** Return unspent campaign funds to the brand once the campaign is closed. */
export async function refundUnspent(db: Executor, actor: Actor, campaignId: string) {
  requireBrand(actor);
  const c = await getOwnedCampaign(db, actor, campaignId);
  if (c.status !== "completed" && c.status !== "cancelled") throw new DomainError("Close the campaign before refunding unspent funds");
  const open = await db
    .select({ id: agreements.id })
    .from(agreements)
    .where(and(eq(agreements.campaignId, c.id), sql`${agreements.status} in ('accepted','disputed','offered')`));
  if (open.length > 0) throw new DomainError("Complete or cancel every collaboration first");
  const available = await campaignFundsAvailable(db, c.id);
  if (available <= 0) throw new DomainError("No unspent funds to refund");
  await db.transaction(async (tx) => {
    await postLedger(tx, {
      idempotencyKey: `refund:${c.id}:${available}`,
      campaignId: c.id,
      entryType: "refund",
      lines: refundLines(available),
      memo: "Unspent campaign funds refunded to brand (test mode)",
    });
    await tx.update(campaigns).set({ fundingState: "refunded" }).where(eq(campaigns.id, c.id));
    await audit(tx, actor, "campaign", c.id, "refunded", { amountMinor: available });
  });
}

// ---------------- disputes ----------------

export const DISPUTE_CATEGORIES = [
  "tracking_failure",
  "invalid_leads",
  "late_approval",
  "scope_change",
  "non_delivery",
  "content_rights",
  "brand_cancellation",
  "payout_delay",
] as const;

export async function openDispute(
  db: Executor,
  actor: Actor,
  rootAgreementId: string,
  input: { category: string; description: string; amountHeldMinor: number },
) {
  const s = await getSettlement(db, actor, rootAgreementId);
  if (s.collab.side === "admin") throw new ForbiddenError();
  if (!s.collab.active || s.collab.active.status === "completed") throw new DomainError("Disputes can be opened on active collaborations");
  if (s.openDispute) throw new DomainError("There's already an open dispute on this collaboration");
  if (!(DISPUTE_CATEGORIES as readonly string[]).includes(input.category)) throw new DomainError("Choose a dispute category");
  if (input.description.trim().length < 20) throw new DomainError("Describe the issue in at least 20 characters");
  if (!Number.isSafeInteger(input.amountHeldMinor) || input.amountHeldMinor < 0) throw new DomainError("Enter a valid amount");
  const ceiling = Math.max(s.result.totalMinor, s.balances.creator_payable + s.balances.dispute_hold);
  if (input.amountHeldMinor > ceiling) throw new DomainError("You can hold at most the amount earned so far");

  await db.transaction(async (tx) => {
    const [d] = await tx
      .insert(disputes)
      .values({
        agreementId: s.collab.root.id,
        openedByUserId: actor.userId,
        category: input.category,
        description: input.description.trim(),
        amountHeldMinor: input.amountHeldMinor,
      })
      .returning();
    await tx.update(agreements).set({ status: "disputed" }).where(eq(agreements.id, s.collab.active!.id));
    // Move any already-approved, unpaid amount into hold (only the disputed portion).
    const moveNow = Math.min(input.amountHeldMinor, s.balances.creator_payable);
    if (moveNow > 0) {
      const lines: LedgerLine[] = [
        { account: "creator_payable", amountMinor: -moveNow },
        { account: "dispute_hold", amountMinor: moveNow },
      ];
      await postLedger(tx, {
        idempotencyKey: `hold:${d!.id}`,
        campaignId: s.collab.campaign.id,
        agreementId: s.collab.root.id,
        creatorProfileId: s.collab.creator.id,
        entryType: "dispute_hold",
        lines,
        referenceType: "dispute",
        referenceId: d!.id,
        memo: "Disputed portion held; undisputed balance remains payable",
      });
    }
    await audit(tx, actor, "dispute", d!.id, "opened", { category: input.category, amountHeldMinor: input.amountHeldMinor });
    const others = s.collab.side === "creator" ? await brandUserIds(tx, s.collab.campaign.organizationId) : [await creatorUserId(tx, s.collab.creator.id)];
    await notify(tx, others, "Dispute opened", `${s.collab.campaign.title}: ${input.category.replace(/_/g, " ")}`, `/collaborations/${s.collab.root.id}/settlement`);
  });
}

export async function resolveDispute(
  db: Executor,
  actor: Actor,
  disputeId: string,
  input: { creatorShareMinor: number; reason: string; outcome: "upheld" | "rejected" | "split" },
) {
  requireAdmin(actor);
  assertUuid(disputeId, "Dispute");
  if (input.reason.trim().length < 10) throw new DomainError("Record a reason of at least 10 characters — it is shown to both parties");
  const [d] = await db.select().from(disputes).where(eq(disputes.id, disputeId));
  if (!d) throw new NotFoundError("Dispute");
  if (d.state === "resolved" || d.state === "rejected") throw new DomainError("This dispute is already closed");
  const [root] = await db.select().from(agreements).where(eq(agreements.id, d.agreementId));
  const entries = await ledgerFor(db, { agreementId: d.agreementId });
  const held = balances(entries).dispute_hold;
  if (!Number.isSafeInteger(input.creatorShareMinor) || input.creatorShareMinor < 0 || input.creatorShareMinor > held)
    throw new DomainError(`Creator share must be between ₹0 and the held amount`);
  await db.transaction(async (tx) => {
    if (held > 0) {
      await postLedger(tx, {
        idempotencyKey: `release:${d.id}`,
        campaignId: root!.campaignId,
        agreementId: d.agreementId,
        creatorProfileId: root!.creatorProfileId,
        entryType: "dispute_release",
        lines: releaseHoldLines(input.creatorShareMinor, held - input.creatorShareMinor),
        referenceType: "dispute",
        referenceId: d.id,
        memo: `Dispute resolved (${input.outcome}): ${input.reason.trim()}`,
      });
    }
    await tx
      .update(disputes)
      .set({ state: input.outcome === "rejected" ? "rejected" : "resolved", resolvedAt: new Date(), resolution: { outcome: input.outcome, reason: input.reason.trim(), by: actor.name } })
      .where(eq(disputes.id, d.id));
    await tx
      .update(agreements)
      .set({ status: "accepted" })
      .where(and(eq(agreements.campaignId, root!.campaignId), eq(agreements.creatorProfileId, root!.creatorProfileId), eq(agreements.status, "disputed")));
    await audit(tx, actor, "dispute", d.id, "resolved", { outcome: input.outcome, creatorShareMinor: input.creatorShareMinor, heldMinor: held }, input.reason);
    const [c] = await tx.select().from(campaigns).where(eq(campaigns.id, root!.campaignId));
    await notify(
      tx,
      [...(await brandUserIds(tx, c!.organizationId)), await creatorUserId(tx, root!.creatorProfileId)],
      "Dispute resolved",
      `${c!.title}: ${input.reason.trim()}`,
      `/collaborations/${root!.id}/settlement`,
    );
  });
}

// ---------------- reporting ----------------

export async function campaignReport(db: Executor, actor: Actor, campaignId: string) {
  const c = await getOwnedCampaign(db, actor, campaignId);
  const rows = await db
    .select({ agreement: agreements, creator: creatorProfiles })
    .from(agreements)
    .innerJoin(creatorProfiles, eq(agreements.creatorProfileId, creatorProfiles.id))
    .where(and(eq(agreements.campaignId, c.id), eq(agreements.version, 1), sql`${agreements.status} <> 'cancelled'`));
  const perCreator = [];
  for (const r of rows) {
    if (r.agreement.status === "offered") continue;
    const s = await getSettlement(db, actor, r.agreement.id);
    const clicks = s.events.filter((e) => e.eventType === "click" && e.validityState === "valid").length;
    perCreator.push({ creator: r.creator, rootId: r.agreement.id, clicks, settlement: s.result, settledToDate: s.settledToDate, paid: s.balances.creator_paid, coupon: r.agreement.couponCode });
  }
  const events = await db.select().from(attributionEvents).where(eq(attributionEvents.campaignId, c.id)).orderBy(asc(attributionEvents.occurredAt));
  const outcomeType = c.compensation.outcomeEvent ?? "signup";
  const days = new Map<string, number>();
  for (const e of events) {
    if (e.eventType !== outcomeType || e.validityState !== "valid") continue;
    const k = e.occurredAt.toISOString().slice(0, 10);
    days.set(k, (days.get(k) ?? 0) + 1);
  }
  const metrics = await db
    .select({ m: schema.metricSnapshots, creator: creatorProfiles })
    .from(schema.metricSnapshots)
    .innerJoin(creatorProfiles, eq(schema.metricSnapshots.creatorProfileId, creatorProfiles.id))
    .where(eq(schema.metricSnapshots.campaignId, c.id))
    .orderBy(asc(schema.metricSnapshots.metricKey));
  const ledger = await ledgerFor(db, { campaignId: c.id });
  const totalOutcomeEvents = events.filter((e) => e.eventType === outcomeType && e.validityState !== "test");
  return {
    campaign: c,
    perCreator,
    series: [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value })),
    events,
    metrics,
    balances: balances(ledger),
    ledger,
    outcomeType,
    attributionCoverage: totalOutcomeEvents.length === 0 ? null : totalOutcomeEvents.filter((e) => e.validityState === "valid").length / totalOutcomeEvents.length,
  };
}

export async function brandLedger(db: Executor, actor: Actor) {
  requireBrand(actor);
  return db
    .select({ entry: ledgerEntries, campaign: campaigns, creator: creatorProfiles })
    .from(ledgerEntries)
    .innerJoin(campaigns, eq(ledgerEntries.campaignId, campaigns.id))
    .leftJoin(creatorProfiles, eq(ledgerEntries.creatorProfileId, creatorProfiles.id))
    .where(eq(campaigns.organizationId, actor.orgId))
    .orderBy(desc(ledgerEntries.createdAt))
    .limit(200);
}

export async function creatorEarnings(db: Executor, actor: Actor) {
  if (actor.role !== "creator" || !actor.creatorProfileId) throw new ForbiddenError();
  const entries = await db
    .select({ entry: ledgerEntries, campaign: campaigns, brand: organizations })
    .from(ledgerEntries)
    .innerJoin(campaigns, eq(ledgerEntries.campaignId, campaigns.id))
    .innerJoin(organizations, eq(campaigns.organizationId, organizations.id))
    .where(eq(ledgerEntries.creatorProfileId, actor.creatorProfileId))
    .orderBy(desc(ledgerEntries.createdAt));
  return { entries, balances: balances(entries.map((e) => e.entry)) };
}

