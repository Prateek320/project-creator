/** Read models for the brand overview and creator home. */
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import { balances } from "@/domain/ledger";
import { requireBrand, requireCreator, type Actor, type Executor } from "./core";
import { getSettlement } from "./finance";

const { campaigns, applications, agreements, deliverables, creatorProfiles, ledgerEntries, attributionEvents, disputes, organizations } = schema;

export async function brandOverview(db: Executor, actor: Actor) {
  requireBrand(actor);
  const org = actor.orgId;
  const camps = await db.select().from(campaigns).where(eq(campaigns.organizationId, org)).orderBy(desc(campaigns.createdAt));
  const ids = camps.map((c) => c.id);
  if (ids.length === 0) return { camps, stats: null, review: [], newApps: [], settle: [], disputesOpen: [] };

  const [review, newApps, ledger, outcomes, roots, disputesOpen] = await Promise.all([
    db
      .select({ d: deliverables, agreement: agreements, creator: creatorProfiles, campaign: campaigns })
      .from(deliverables)
      .innerJoin(agreements, eq(deliverables.agreementId, agreements.id))
      .innerJoin(campaigns, eq(agreements.campaignId, campaigns.id))
      .innerJoin(creatorProfiles, eq(agreements.creatorProfileId, creatorProfiles.id))
      .where(and(inArray(agreements.campaignId, ids), inArray(deliverables.approvalState, ["submitted", "resubmitted"])))
      .orderBy(deliverables.submittedAt),
    db
      .select({ app: applications, creator: creatorProfiles, campaign: campaigns })
      .from(applications)
      .innerJoin(creatorProfiles, eq(applications.creatorProfileId, creatorProfiles.id))
      .innerJoin(campaigns, eq(applications.campaignId, campaigns.id))
      .where(and(inArray(applications.campaignId, ids), eq(applications.status, "submitted")))
      .orderBy(desc(applications.createdAt)),
    db.select().from(ledgerEntries).where(inArray(ledgerEntries.campaignId, ids)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(attributionEvents)
      .where(and(inArray(attributionEvents.campaignId, ids), eq(attributionEvents.validityState, "valid"), sql`${attributionEvents.eventType} <> 'click'`)),
    db
      .select({ id: agreements.id })
      .from(agreements)
      .where(and(inArray(agreements.campaignId, ids), eq(agreements.version, 1), sql`exists (select 1 from agreements g where g.campaign_id = agreements.campaign_id and g.creator_profile_id = agreements.creator_profile_id and g.status in ('accepted','disputed'))`)),
    db
      .select({ dispute: disputes, campaign: campaigns })
      .from(disputes)
      .innerJoin(agreements, eq(disputes.agreementId, agreements.id))
      .innerJoin(campaigns, eq(agreements.campaignId, campaigns.id))
      .where(and(inArray(agreements.campaignId, ids), inArray(disputes.state, ["open", "under_review"]))),
  ]);
  const settle = [];
  for (const r of roots) {
    const s = await getSettlement(db, actor, r.id);
    if (s.pendingApprovalMinor > 0 || s.balances.creator_payable > 0)
      settle.push({ rootId: r.id, creator: s.collab.creator, campaign: s.collab.campaign, pending: s.pendingApprovalMinor, payable: s.balances.creator_payable });
  }
  const b = balances(ledger);
  return {
    camps,
    stats: {
      live: camps.filter((c) => c.status === "published").length,
      funded: -b.brand_external - b.brand_refund,
      held: b.campaign_funds,
      paidOut: b.creator_paid,
      committed: b.creator_payable + b.dispute_hold + b.creator_paid,
      outcomes: outcomes[0]?.n ?? 0,
    },
    review,
    newApps,
    settle,
    disputesOpen,
  };
}

export async function creatorHome(db: Executor, actor: Actor) {
  requireCreator(actor);
  const me = actor.creatorProfileId;
  const [profile] = await db.select().from(creatorProfiles).where(eq(creatorProfiles.id, me));
  const [todo, offers, ledger, apps] = await Promise.all([
    db
      .select({ d: deliverables, campaign: campaigns, agreement: agreements })
      .from(deliverables)
      .innerJoin(agreements, eq(deliverables.agreementId, agreements.id))
      .innerJoin(campaigns, eq(agreements.campaignId, campaigns.id))
      .where(and(eq(agreements.creatorProfileId, me), inArray(deliverables.approvalState, ["pending", "changes_requested"])))
      .orderBy(deliverables.dueAt),
    db
      .select({ agreement: agreements, campaign: campaigns, brand: organizations })
      .from(agreements)
      .innerJoin(campaigns, eq(agreements.campaignId, campaigns.id))
      .innerJoin(organizations, eq(campaigns.organizationId, organizations.id))
      .where(and(eq(agreements.creatorProfileId, me), eq(agreements.status, "offered"), sql`${agreements.acceptedByCreatorAt} is null`)),
    db.select().from(ledgerEntries).where(eq(ledgerEntries.creatorProfileId, me)),
    db.select({ status: applications.status }).from(applications).where(eq(applications.creatorProfileId, me)),
  ]);
  const b = balances(ledger);
  const filled = [profile?.bio, profile?.headline, profile?.location, (profile?.languages.length ?? 0) > 0, (profile?.niches.length ?? 0) > 0, (profile?.rateMaxMinor ?? 0) > 0];
  const [accts] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.socialAccounts).where(and(eq(schema.socialAccounts.creatorProfileId, me), sql`connection_state <> 'disconnected'`));
  const [port] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.portfolioItems).where(eq(schema.portfolioItems.creatorProfileId, me));
  const strength = Math.round(((filled.filter(Boolean).length + ((accts?.n ?? 0) > 0 ? 2 : 0) + ((port?.n ?? 0) > 0 ? 2 : 0)) / (filled.length + 4)) * 100);
  return {
    profile: profile!,
    strength,
    todo,
    offers,
    balances: b,
    openApps: apps.filter((a) => a.status === "submitted" || a.status === "shortlisted").length,
  };
}
