/**
 * Read models for every role's home dashboard. One row shape (DashRow) and one interaction
 * pattern (stat cards = filters) across creator, brand and operations.
 */
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import { describeFormula } from "@/domain/compensation";
import { balances, ACCOUNTS } from "@/domain/ledger";
import { formatINR } from "@/domain/money";
import type { Formula } from "@/domain/types";
import { dueOf, shortDate, type ContinueCard, type DashRow } from "@/components/dashboard/types";
import { requireAdmin, requireBrand, requireCreator, type Actor, type Executor } from "./core";
import { creatorHome } from "./dashboards";
import { discoverCreators } from "./creators";
import { getSettlement } from "./finance";

const { campaigns, applications, agreements, deliverables, creatorProfiles, ledgerEntries, organizations, disputes, attributionEvents, paymentTransfers, users } = schema;

export interface SheetCampaign {
  id: string;
  title: string;
  brand: string;
  brief: string;
  niche: string;
  channels: string;
  formula: Formula;
  formulaText: string;
  target: number;
  runs: string;
  applyBy: string;
  rights: string;
  model: string;
}

const MODEL: Record<string, string> = { fixed: "Fixed fee", hybrid: "Hybrid", performance: "Performance" };

const activeExists = sql`exists (select 1 from agreements g where g.campaign_id = agreements.campaign_id and g.creator_profile_id = agreements.creator_profile_id and g.status in ('accepted','disputed'))`;

// ============================== creator ==============================

export async function creatorHomeData(db: Executor, actor: Actor) {
  requireCreator(actor);
  const base = await creatorHome(db, actor);
  const me = actor.creatorProfileId;
  const now = Date.now();
  const rows: DashRow[] = [];

  for (const { agreement, campaign, brand } of base.offers) {
    rows.push({
      id: `offer-${agreement.id}`,
      view: "action",
      tags: ["offers"],
      kind: "offer",
      title: agreement.version > 1 ? `Amendment v${agreement.version} · ${campaign.title}` : `Offer · ${campaign.title}`,
      subtitle: agreement.version > 1 ? (agreement.changeSummary ?? "Changed terms to review") : "Review the terms and accept to start",
      status: "offered",
      href: `/collaborations/${agreement.id}`,
      context: brand.displayName,
      at: agreement.createdAt.toISOString(),
    });
  }
  for (const { d, campaign, agreement } of base.todo) {
    const due = dueOf(d.dueAt, now);
    rows.push({
      id: `todo-${d.id}`,
      view: "action",
      tags: [d.approvalState === "changes_requested" ? "changes" : "", due && due.tone !== "ok" ? "soon" : ""].filter(Boolean),
      kind: "todo",
      title: d.title,
      subtitle: d.approvalState === "changes_requested" ? `Brand asked for changes · ${campaign.title}` : campaign.title,
      status: d.approvalState,
      href: `/collaborations/${agreement.id}`,
      due,
      at: d.dueAt.toISOString(),
    });
  }

  const roots = await db
    .select({ agreement: agreements, campaign: campaigns, brand: organizations })
    .from(agreements)
    .innerJoin(campaigns, eq(agreements.campaignId, campaigns.id))
    .innerJoin(organizations, eq(campaigns.organizationId, organizations.id))
    .where(and(eq(agreements.creatorProfileId, me), eq(agreements.version, 1), activeExists));
  let cont: { row: DashRow; earned: number; rank: number } | null = null;
  for (const r of roots) {
    const s = await getSettlement(db, actor, r.agreement.id);
    const ds = s.collab.deliverables;
    const done = ds.filter((d) => d.approvalState === "approved").length;
    const inReview = ds.some((d) => d.approvalState === "submitted" || d.approvalState === "resubmitted");
    const next = ds.filter((d) => d.approvalState !== "approved").sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())[0];
    const row: DashRow = {
      id: `collab-${r.agreement.id}`,
      view: "active",
      tags: [inReview ? "review" : "", s.openDispute ? "dispute" : "ontrack"].filter(Boolean),
      kind: "collab",
      title: r.campaign.title,
      subtitle: inReview ? "Content with the brand for review" : next ? `Next: ${next.title}` : "All deliverables approved",
      status: s.collab.active?.status ?? "accepted",
      href: `/collaborations/${r.agreement.id}`,
      context: r.brand.displayName,
      amountMinor: s.result.totalMinor,
      amountLabel: "earned so far",
      due: next && !inReview ? dueOf(next.dueAt, now) : undefined,
      progress: { done, total: ds.length },
      at: r.agreement.createdAt.toISOString(),
    };
    rows.push(row);
    const rank = next ? next.dueAt.getTime() : Number.MAX_SAFE_INTEGER;
    if (!cont || rank < cont.rank) cont = { row, earned: s.result.totalMinor, rank };
  }

  const apps = await db
    .select({ app: applications, campaign: campaigns, brand: organizations })
    .from(applications)
    .innerJoin(campaigns, eq(applications.campaignId, campaigns.id))
    .innerJoin(organizations, eq(campaigns.organizationId, organizations.id))
    .where(eq(applications.creatorProfileId, me))
    .orderBy(desc(applications.updatedAt));
  const NEXT: Record<string, string> = {
    submitted: "Waiting for the brand to review",
    shortlisted: "On the shortlist — an offer may follow",
    offered: "Offer waiting for you",
    accepted: "Hired",
    rejected: "The brand went another way",
    withdrawn: "You withdrew",
    expired: "Campaign closed",
  };
  for (const { app, campaign, brand } of apps) {
    const closed = ["rejected", "withdrawn", "expired", "accepted"].includes(app.status);
    rows.push({
      id: `app-${app.id}`,
      view: "applications",
      tags: [closed ? "closed" : app.status],
      kind: "application",
      title: campaign.title,
      subtitle: NEXT[app.status] ?? app.status,
      status: app.status,
      href: `/creator/campaigns/${campaign.id}`,
      context: brand.displayName,
      amountMinor: app.proposedRateMinor,
      amountLabel: "asked",
      at: app.updatedAt.toISOString(),
    });
  }

  const ledger = await db
    .select({ entry: ledgerEntries, campaign: campaigns, brand: organizations })
    .from(ledgerEntries)
    .innerJoin(campaigns, eq(ledgerEntries.campaignId, campaigns.id))
    .innerJoin(organizations, eq(campaigns.organizationId, organizations.id))
    .where(and(eq(ledgerEntries.creatorProfileId, me), sql`${ledgerEntries.amountMinor} > 0`, inArray(ledgerEntries.account, ["creator_paid", "creator_payable", "dispute_hold"])))
    .orderBy(desc(ledgerEntries.createdAt));
  const EARN: Record<string, [string, string, string]> = {
    creator_paid: ["Paid to you", "paid", "paid"],
    creator_payable: ["Approved, on its way", "payable", "approved"],
    dispute_hold: ["Held for a dispute", "held", "disputed"],
  };
  for (const { entry, campaign, brand } of ledger) {
    const [label, tag, status] = EARN[entry.account] ?? [entry.entryType, "", "settled"];
    rows.push({
      id: `earn-${entry.id}`,
      view: "earnings",
      tags: [tag],
      kind: "earning",
      title: label,
      subtitle: `${campaign.title} · ${shortDate(entry.createdAt)}`,
      status,
      href: entry.agreementId ? `/collaborations/${entry.agreementId}/settlement` : "/creator/earnings",
      context: brand.displayName,
      amountMinor: entry.amountMinor,
      at: entry.createdAt.toISOString(),
    });
  }

  // Recommendations: open campaigns, niche first, not already applied to.
  const applied = new Set(apps.map((a) => a.campaign.id));
  const recs = await db
    .select({ campaign: campaigns, brand: organizations })
    .from(campaigns)
    .innerJoin(organizations, eq(campaigns.organizationId, organizations.id))
    .where(and(eq(campaigns.status, "published"), eq(campaigns.visibility, "public")))
    .orderBy(desc(campaigns.publishedAt))
    .limit(20);
  const niches = base.profile.niches;
  const recommended: SheetCampaign[] = recs
    .filter((r) => !applied.has(r.campaign.id))
    .sort((a, b) => Number(niches.includes(b.campaign.niche)) - Number(niches.includes(a.campaign.niche)))
    .slice(0, 3)
    .map(({ campaign: c, brand }) => ({
      id: c.id,
      title: c.title,
      brand: brand.displayName,
      brief: c.brief,
      niche: c.niche,
      channels: c.channels.join(" · "),
      formula: c.compensation,
      formulaText: describeFormula(c.compensation),
      target: c.measurement.target,
      runs: `${shortDate(c.startAt)} – ${shortDate(c.endAt)}`,
      applyBy: c.applyBy ? shortDate(c.applyBy) : "Until slots fill",
      rights: c.rights,
      model: MODEL[c.compensation.model] ?? c.compensation.model,
    }));

  sortRows(rows, "action");
  const b = base.balances;
  const counts = {
    action: rows.filter((r) => r.view === "action").length,
    active: rows.filter((r) => r.view === "active").length,
    applications: rows.filter((r) => r.view === "applications" && !r.tags.includes("closed")).length,
  };
  const continueCard: ContinueCard | null = cont
    ? {
        label: "Continue where you left off",
        eyebrow: cont.row.context ?? "",
        title: cont.row.title,
        subtitle: cont.row.subtitle,
        href: cont.row.href,
        amountMinor: cont.earned,
        amountLabel: "earned so far",
        progress: cont.row.progress ? { ...cont.row.progress, label: `${cont.row.progress.done}/${cont.row.progress.total} approved` } : undefined,
      }
    : null;
  return { profile: base.profile, strength: base.strength, balances: b, rows, counts, continueCard, recommended };
}

// ============================== brand ==============================

export interface SheetCreator {
  id: string;
  name: string;
  headline: string;
  location: string;
  niches: string;
  accent: string;
  completed: number;
  onTime: string;
  verified: number;
  rating: string;
  rate: string;
  verifiedId: boolean;
}

export async function brandHomeData(db: Executor, actor: Actor) {
  requireBrand(actor);
  const org = actor.orgId;
  const now = Date.now();
  const rows: DashRow[] = [];
  const camps = await db
    .select({
      campaign: campaigns,
      applicants: sql<number>`(select count(*)::int from applications a where a.campaign_id = campaigns.id)`,
      newApplicants: sql<number>`(select count(*)::int from applications a where a.campaign_id = campaigns.id and a.status = 'submitted')`,
      hired: sql<number>`(select count(*)::int from agreements g where g.campaign_id = campaigns.id and g.version = 1 and g.status <> 'cancelled' and exists (select 1 from agreements h where h.campaign_id = g.campaign_id and h.creator_profile_id = g.creator_profile_id and h.status in ('accepted','disputed','completed')))`,
      outcomes: sql<number>`(select count(*)::int from attribution_events e where e.campaign_id = campaigns.id and e.validity_state = 'valid' and e.event_type <> 'click')`,
    })
    .from(campaigns)
    .where(eq(campaigns.organizationId, org))
    .orderBy(desc(campaigns.createdAt));
  const ids = camps.map((c) => c.campaign.id);
  const titleOf = new Map(camps.map((c) => [c.campaign.id, c.campaign.title]));

  // --- Needs you ---
  if (ids.length) {
    const toReview = await db
      .select({ d: deliverables, agreement: agreements, creator: creatorProfiles })
      .from(deliverables)
      .innerJoin(agreements, eq(deliverables.agreementId, agreements.id))
      .innerJoin(creatorProfiles, eq(agreements.creatorProfileId, creatorProfiles.id))
      .where(and(inArray(agreements.campaignId, ids), inArray(deliverables.approvalState, ["submitted", "resubmitted"])))
      .orderBy(deliverables.submittedAt);
    for (const { d, agreement, creator } of toReview) {
      rows.push({
        id: `review-${d.id}`,
        view: "action",
        tags: ["review"],
        kind: "review",
        title: `${creator.displayName} · ${d.title}`,
        subtitle: `${titleOf.get(agreement.campaignId)} · submitted ${d.submittedAt ? shortDate(d.submittedAt) : ""}`,
        status: d.approvalState,
        href: `/collaborations/${agreement.id}`,
        at: (d.submittedAt ?? d.dueAt).toISOString(),
      });
    }
    const roots = await db
      .select({ agreement: agreements, creator: creatorProfiles })
      .from(agreements)
      .innerJoin(creatorProfiles, eq(agreements.creatorProfileId, creatorProfiles.id))
      .where(and(inArray(agreements.campaignId, ids), eq(agreements.version, 1), activeExists));
    for (const r of roots) {
      const s = await getSettlement(db, actor, r.agreement.id);
      if (s.pendingApprovalMinor > 0) {
        rows.push({
          id: `approve-${r.agreement.id}`,
          view: "action",
          tags: ["money"],
          kind: "settle",
          title: `Approve earnings · ${r.creator.displayName}`,
          subtitle: `${titleOf.get(r.agreement.campaignId)} · ${s.result.lines.map((l) => l.label).filter((l) => l !== "Excluded events").join(" + ")}`,
          status: "approve",
          href: `/collaborations/${r.agreement.id}/settlement`,
          amountMinor: s.pendingApprovalMinor,
          amountLabel: "to approve",
          at: new Date().toISOString(),
        });
      }
      if (s.balances.creator_payable > 0) {
        rows.push({
          id: `pay-${r.agreement.id}`,
          view: "action",
          tags: ["money"],
          kind: "settle",
          title: `Pay out · ${r.creator.displayName}`,
          subtitle: `${titleOf.get(r.agreement.campaignId)} · approved and undisputed`,
          status: "payout",
          href: `/collaborations/${r.agreement.id}/settlement`,
          amountMinor: s.balances.creator_payable,
          amountLabel: "ready to pay",
          at: new Date().toISOString(),
        });
      }
    }
    const openDisputes = await db
      .select({ dispute: disputes, agreement: agreements, creator: creatorProfiles })
      .from(disputes)
      .innerJoin(agreements, eq(disputes.agreementId, agreements.id))
      .innerJoin(creatorProfiles, eq(agreements.creatorProfileId, creatorProfiles.id))
      .where(and(inArray(agreements.campaignId, ids), inArray(disputes.state, ["open", "under_review"])));
    for (const { dispute, agreement, creator } of openDisputes) {
      rows.push({
        id: `dispute-${dispute.id}`,
        view: "action",
        tags: ["disputes"],
        kind: "dispute",
        title: `Dispute · ${dispute.category.replace(/_/g, " ")}`,
        subtitle: `${creator.displayName} · ${titleOf.get(agreement.campaignId)} · with operations`,
        status: dispute.state,
        href: `/collaborations/${agreement.id}/settlement`,
        amountMinor: dispute.amountHeldMinor,
        amountLabel: "held",
        at: dispute.createdAt.toISOString(),
      });
    }
  }

  // --- Campaigns ---
  for (const c of camps) {
    const camp = c.campaign;
    const tag = camp.status === "published" || camp.status === "paused" ? "live" : camp.status === "draft" ? "draft" : "closed";
    rows.push({
      id: `camp-${camp.id}`,
      view: "campaigns",
      tags: [tag, camp.fundingState === "not_funded" && tag === "live" ? "unfunded" : ""].filter(Boolean),
      kind: "campaign",
      title: camp.title,
      subtitle: `${describeFormula(camp.compensation)}`,
      status: camp.status,
      href: `/brand/campaigns/${camp.id}`,
      context: `${shortDate(camp.startAt)} – ${shortDate(camp.endAt)}`,
      amountMinor: camp.budgetMinor,
      amountLabel: `${c.applicants} applicant${c.applicants === 1 ? "" : "s"}`,
      progress: { done: c.hired, total: camp.creatorSlots },
      due: tag === "live" && camp.applyBy ? { ...dueOf(camp.applyBy, now)!, text: `Apply by ${shortDate(camp.applyBy)}` } : undefined,
      at: camp.createdAt.toISOString(),
    });
  }

  // --- Applicants ---
  if (ids.length) {
    const apps = await db
      .select({ app: applications, creator: creatorProfiles })
      .from(applications)
      .innerJoin(creatorProfiles, eq(applications.creatorProfileId, creatorProfiles.id))
      .where(inArray(applications.campaignId, ids))
      .orderBy(desc(applications.updatedAt));
    for (const { app, creator } of apps) {
      const closed = ["rejected", "withdrawn", "expired"].includes(app.status);
      rows.push({
        id: `applicant-${app.id}`,
        view: "applicants",
        tags: [closed ? "closed" : app.status === "accepted" ? "hired" : app.status],
        kind: "applicant",
        title: creator.displayName,
        subtitle: `${titleOf.get(app.campaignId)} · ${creator.headline}`,
        status: app.status,
        href: `/brand/campaigns/${app.campaignId}/applications`,
        context: creator.location.split(",")[0],
        amountMinor: app.proposedRateMinor,
        amountLabel: "asks",
        at: app.updatedAt.toISOString(),
      });
    }
  }

  // --- Spend (one row per ledger transaction) ---
  const ledger = ids.length
    ? await db
        .select({ entry: ledgerEntries, creator: creatorProfiles })
        .from(ledgerEntries)
        .leftJoin(creatorProfiles, eq(ledgerEntries.creatorProfileId, creatorProfiles.id))
        .where(inArray(ledgerEntries.campaignId, ids))
        .orderBy(desc(ledgerEntries.createdAt))
    : [];
  const seen = new Set<string>();
  const SPEND: Record<string, [string, string, string]> = {
    funding: ["Campaign funded", "funded", "funding"],
    settlement: ["Earnings approved", "approved", "settlement"],
    payout: ["Paid to creator", "paid", "payout_done"],
    refund: ["Refunded to you", "refunded", "refund"],
    dispute_hold: ["Held for dispute", "held", "disputed"],
    dispute_release: ["Dispute released", "approved", "settlement"],
    reversal: ["Payout reversed", "refunded", "refund"],
  };
  for (const { entry, creator } of ledger) {
    if (seen.has(entry.transactionGroupId)) continue;
    seen.add(entry.transactionGroupId);
    const group = ledger.filter((l) => l.entry.transactionGroupId === entry.transactionGroupId);
    const amount = group.filter((l) => l.entry.amountMinor > 0).reduce((s, l) => s + l.entry.amountMinor, 0);
    const [label, tag, status] = SPEND[entry.entryType] ?? [entry.entryType, "", "settlement"];
    rows.push({
      id: `spend-${entry.transactionGroupId}`,
      view: "spend",
      tags: [tag],
      kind: "ledger",
      title: creator ? `${label} · ${creator.displayName}` : label,
      subtitle: `${titleOf.get(entry.campaignId)} · ${shortDate(entry.createdAt)}`,
      status,
      href: entry.agreementId ? `/collaborations/${entry.agreementId}/settlement` : `/brand/campaigns/${entry.campaignId}`,
      amountMinor: amount,
      at: entry.createdAt.toISOString(),
    });
  }

  // --- side: creators with the strongest verified record ---
  const disc = await discoverCreators(db, { limit: 12 });
  const topCreators: SheetCreator[] = disc.items
    .sort((a, b) => b.reputation.verifiedOutcomes - a.reputation.verifiedOutcomes || b.reputation.completed - a.reputation.completed)
    .slice(0, 3)
    .map(({ profile: p, reputation: r }) => ({
      id: p.id,
      name: p.displayName,
      headline: p.headline,
      location: p.location,
      niches: p.niches.join(" · "),
      accent: p.accent,
      completed: r.completed,
      onTime: r.onTimeRate === null ? "—" : `${Math.round(r.onTimeRate * 100)}%`,
      verified: r.verifiedOutcomes,
      rating: r.avgRating ? `${r.avgRating.toFixed(1)} / 5` : "—",
      rate: `${formatINR(p.rateMinMinor)}–${formatINR(p.rateMaxMinor)}`,
      verifiedId: p.verificationState === "verified",
    }));

  sortRows(rows, "action");
  const allLedger = ledger.map((l) => l.entry);
  const b = balances(allLedger);
  const live = camps.filter((c) => c.campaign.status === "published");
  const top = live.sort((a, b2) => b2.outcomes - a.outcomes)[0];
  const continueCard: ContinueCard | null = top
    ? {
        label: "Your top live campaign",
        eyebrow: `${top.campaign.niche} · ${MODEL[top.campaign.compensation.model]}`,
        title: top.campaign.title,
        subtitle: `${top.outcomes} verified ${top.campaign.compensation.outcomeEvent ?? "outcome"}s · ${top.newApplicants} new applicant${top.newApplicants === 1 ? "" : "s"}`,
        href: `/brand/campaigns/${top.campaign.id}/analytics`,
        amountMinor: top.campaign.budgetMinor,
        amountLabel: "budget",
        progress: { done: top.hired, total: top.campaign.creatorSlots, label: `${top.hired}/${top.campaign.creatorSlots} creators hired` },
      }
    : null;
  return {
    rows,
    counts: {
      action: rows.filter((r) => r.view === "action").length,
      live: live.length,
      newApplicants: rows.filter((r) => r.view === "applicants" && r.tags.includes("submitted")).length,
    },
    balances: b,
    continueCard,
    topCreators,
  };
}

// ============================== operations ==============================

export async function adminHomeData(db: Executor, actor: Actor) {
  requireAdmin(actor);
  const rows: DashRow[] = [];
  const open = await db
    .select({ dispute: disputes, agreement: agreements, campaign: campaigns, creator: creatorProfiles, opener: users })
    .from(disputes)
    .innerJoin(agreements, eq(disputes.agreementId, agreements.id))
    .innerJoin(campaigns, eq(agreements.campaignId, campaigns.id))
    .innerJoin(creatorProfiles, eq(agreements.creatorProfileId, creatorProfiles.id))
    .innerJoin(users, eq(disputes.openedByUserId, users.id))
    .orderBy(disputes.createdAt);
  for (const { dispute: d, campaign, creator, opener } of open) {
    const isOpen = d.state === "open" || d.state === "under_review";
    rows.push({
      id: `d-${d.id}`,
      view: "disputes",
      tags: [isOpen ? "open" : "resolved"],
      kind: "dispute",
      title: `${d.category.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())}`,
      subtitle: `${campaign.title} · ${creator.displayName} · opened by ${opener.name}`,
      status: isOpen ? d.state : "completed",
      href: `/admin/disputes/${d.id}`,
      amountMinor: d.amountHeldMinor,
      amountLabel: "hold requested",
      context: shortDate(d.createdAt),
      at: d.createdAt.toISOString(),
    });
  }
  const events = await db
    .select({ event: attributionEvents, campaign: campaigns, creator: creatorProfiles, agreement: agreements })
    .from(attributionEvents)
    .innerJoin(campaigns, eq(attributionEvents.campaignId, campaigns.id))
    .innerJoin(creatorProfiles, eq(attributionEvents.creatorProfileId, creatorProfiles.id))
    .innerJoin(agreements, and(eq(agreements.campaignId, attributionEvents.campaignId), eq(agreements.creatorProfileId, attributionEvents.creatorProfileId), eq(agreements.version, 1)))
    .where(inArray(attributionEvents.validityState, ["invalid", "out_of_window"]))
    .orderBy(desc(attributionEvents.receivedAt))
    .limit(50);
  for (const { event: e, campaign, creator, agreement } of events) {
    rows.push({
      id: `e-${e.id}`,
      view: "events",
      tags: [e.validityState === "invalid" ? "manual" : "window"],
      kind: "event",
      title: e.eventId,
      subtitle: `${campaign.title} · ${creator.displayName} · ${e.reasonCode?.replace(/_/g, " ") ?? "—"}`,
      status: e.validityState,
      href: `/collaborations/${agreement.id}/settlement`,
      context: e.eventType,
      at: e.receivedAt.toISOString(),
    });
  }
  const pendingCreators = await db.select().from(creatorProfiles).where(eq(creatorProfiles.verificationState, "pending"));
  for (const c of pendingCreators) {
    rows.push({ id: `vc-${c.id}`, view: "verify", tags: ["creators"], kind: "verify", title: c.displayName, subtitle: `Creator ID · ${c.headline}`, status: "verify_pending", href: `/admin/queue#verification`, context: c.location.split(",")[0], at: c.updatedAt.toISOString() });
  }
  const pendingOrgs = await db.select().from(organizations).where(eq(organizations.verificationState, "pending"));
  for (const o of pendingOrgs) {
    rows.push({ id: `vo-${o.id}`, view: "verify", tags: ["businesses"], kind: "verify", title: o.displayName, subtitle: `Business KYB · ${o.legalName}`, status: "verify_pending", href: `/admin/queue#verification`, at: o.createdAt.toISOString() });
  }
  const transfers = await db
    .select({ t: paymentTransfers, campaign: campaigns, creator: creatorProfiles })
    .from(paymentTransfers)
    .innerJoin(agreements, eq(paymentTransfers.agreementId, agreements.id))
    .innerJoin(campaigns, eq(agreements.campaignId, campaigns.id))
    .innerJoin(creatorProfiles, eq(agreements.creatorProfileId, creatorProfiles.id))
    .orderBy(desc(paymentTransfers.createdAt));
  for (const { t, campaign, creator } of transfers) {
    rows.push({
      id: `t-${t.id}`,
      view: "payments",
      tags: [t.state === "failed" ? "failed" : t.state === "paid" ? "paid" : "other"],
      kind: t.state === "failed" ? "transfer" : "ledger",
      title: `${creator.displayName} · ${campaign.title}`,
      subtitle: `${t.provider} · ${t.providerRef} · ${shortDate(t.createdAt)}`,
      status: t.state === "paid" ? "paid" : t.state,
      href: `/collaborations/${t.agreementId}/settlement`,
      amountMinor: t.amountMinor,
      at: t.createdAt.toISOString(),
    });
  }
  rows.sort((a, b) => b.at.localeCompare(a.at));
  const openCount = rows.filter((r) => r.view === "disputes" && r.tags.includes("open")).length;
  return {
    rows,
    counts: {
      disputes: openCount,
      events: rows.filter((r) => r.view === "events").length,
      verify: rows.filter((r) => r.view === "verify").length,
      failed: rows.filter((r) => r.view === "payments" && r.tags.includes("failed")).length,
      paidMinor: transfers.filter((t) => t.t.state === "paid").reduce((s, t) => s + t.t.amountMinor, 0),
    },
  };
}

function sortRows(rows: DashRow[], actionView: string) {
  const pri = (r: DashRow) => (r.kind === "offer" || r.kind === "review" ? 0 : r.kind === "settle" ? 1 : r.kind === "dispute" ? 2 : 3);
  rows.sort((a, b) =>
    a.view === actionView && b.view === actionView ? pri(a) - pri(b) || (a.due ? a.at : "~").localeCompare(b.due ? b.at : "~") || a.at.localeCompare(b.at) : b.at.localeCompare(a.at),
  );
}

export { ACCOUNTS };
