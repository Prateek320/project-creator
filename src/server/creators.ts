/** Creator profiles, discovery, reputation and explainable (advisory) match reasons. */
import { and, desc, eq, ilike, inArray, lt, or, sql, type SQL } from "drizzle-orm";
import * as schema from "@/db/schema";
import { DomainError } from "@/domain/types";
import { assertUuid, audit, NotFoundError, requireCreator, type Actor, type Executor } from "./core";

const { creatorProfiles, socialAccounts, metricSnapshots, portfolioItems, agreements, reviews, applications, campaigns, attributionEvents } =
  schema;

export const NICHES = ["Beauty", "Fashion", "Fitness", "Food", "Tech", "Travel", "Finance", "Parenting", "Lifestyle", "Gaming"];
export const CHANNELS = ["Instagram", "YouTube", "Blog", "Podcast"];
export const AUDIENCE_BANDS = ["1k-10k", "10k-50k", "50k-200k", "200k-1M", "1M+"];

export interface Reputation {
  completed: number;
  onTimeRate: number | null;
  avgRating: number | null;
  verifiedOutcomes: number;
  disputes: number;
}

/** Track record from completed, verified collaborations — not follower counts. */
export async function reputationFor(db: Executor, creatorProfileIds: string[]): Promise<Map<string, Reputation>> {
  const out = new Map<string, Reputation>();
  if (creatorProfileIds.length === 0) return out;
  const rows = await db
    .select({
      creator_profile_id: creatorProfiles.id,
      completed: sql<number>`(select count(*)::int from agreements a where a.creator_profile_id = creator_profiles.id and a.status = 'completed')`,
      on_time: sql<number>`(select count(*)::int from deliverables d join agreements a on a.id = d.agreement_id
         where a.creator_profile_id = creator_profiles.id and d.approval_state = 'approved' and d.submitted_at <= d.due_at)`,
      delivered: sql<number>`(select count(*)::int from deliverables d join agreements a on a.id = d.agreement_id
         where a.creator_profile_id = creator_profiles.id and d.approval_state = 'approved')`,
      avg_rating: sql<number | null>`(select avg(r.rating)::float from reviews r join agreements a on a.id = r.agreement_id
         where a.creator_profile_id = creator_profiles.id and r.moderation_state = 'published')`,
      verified: sql<number>`(select count(*)::int from attribution_events e where e.creator_profile_id = creator_profiles.id
         and e.validity_state = 'valid' and e.event_type <> 'click')`,
      disputes: sql<number>`(select count(*)::int from disputes x join agreements a on a.id = x.agreement_id
         where a.creator_profile_id = creator_profiles.id and x.state = 'resolved' and (x.resolution->>'outcome') = 'upheld')`,
    })
    .from(creatorProfiles)
    .where(inArray(creatorProfiles.id, creatorProfileIds));
  for (const r of rows) {
    out.set(r.creator_profile_id, {
      completed: Number(r.completed),
      onTimeRate: Number(r.delivered) > 0 ? Number(r.on_time) / Number(r.delivered) : null,
      avgRating: r.avg_rating === null ? null : Number(r.avg_rating),
      verifiedOutcomes: Number(r.verified),
      disputes: Number(r.disputes),
    });
  }
  return out;
}

export interface CreatorFilters {
  q?: string;
  niche?: string;
  channel?: string;
  band?: string;
  location?: string;
  cursor?: string;
  limit?: number;
}

export async function discoverCreators(db: Executor, f: CreatorFilters) {
  const limit = Math.min(Math.max(f.limit ?? 12, 1), 50);
  const conds: SQL[] = [eq(creatorProfiles.visibility, "public")];
  if (f.q) {
    const q = `%${f.q.slice(0, 80)}%`;
    const m = or(ilike(creatorProfiles.displayName, q), ilike(creatorProfiles.headline, q), ilike(creatorProfiles.bio, q));
    if (m) conds.push(m);
  }
  if (f.niche) conds.push(sql`${creatorProfiles.niches} ? ${f.niche}`);
  if (f.band) conds.push(eq(creatorProfiles.audienceBand, f.band));
  if (f.location) conds.push(ilike(creatorProfiles.location, `%${f.location.slice(0, 40)}%`));
  if (f.channel)
    conds.push(
      sql`exists (select 1 from social_accounts s where s.creator_profile_id = creator_profiles.id and s.platform = ${f.channel} and s.connection_state <> 'disconnected')`,
    );
  if (f.cursor) {
    const [ts, cid] = Buffer.from(f.cursor, "base64url").toString().split("|");
    if (ts && cid) {
      const d = new Date(ts);
      const c = or(lt(creatorProfiles.createdAt, d), and(eq(creatorProfiles.createdAt, d), lt(creatorProfiles.id, cid)));
      if (c) conds.push(c);
    }
  }
  const rows = await db
    .select()
    .from(creatorProfiles)
    .where(and(...conds))
    .orderBy(desc(creatorProfiles.createdAt), desc(creatorProfiles.id))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  const nextCursor = rows.length > limit && last ? Buffer.from(`${last.createdAt.toISOString()}|${last.id}`).toString("base64url") : null;
  const ids = page.map((p) => p.id);
  const [rep, accounts] = await Promise.all([
    reputationFor(db, ids),
    ids.length
      ? db.select().from(socialAccounts).where(inArray(socialAccounts.creatorProfileId, ids))
      : Promise.resolve([]),
  ]);
  const metrics = ids.length ? await latestMetrics(db, ids) : new Map<string, MetricRow[]>();
  return {
    items: page.map((p) => ({
      profile: p,
      reputation: rep.get(p.id)!,
      accounts: accounts.filter((a) => a.creatorProfileId === p.id),
      metrics: metrics.get(p.id) ?? [],
    })),
    nextCursor,
  };
}

type MetricRow = typeof metricSnapshots.$inferSelect;

/** Latest snapshot per (creator, metric_key, account) — profile-level metrics only. */
export async function latestMetrics(db: Executor, creatorIds: string[]): Promise<Map<string, MetricRow[]>> {
  const rows = await db
    .select()
    .from(metricSnapshots)
    .where(
      and(
        inArray(metricSnapshots.creatorProfileId, creatorIds),
        sql`${metricSnapshots.campaignId} is null`,
      ),
    )
    .orderBy(desc(metricSnapshots.observedAt));
  const out = new Map<string, MetricRow[]>();
  const seen = new Set<string>();
  for (const r of rows) {
    const k = `${r.creatorProfileId}|${r.metricKey}|${r.socialAccountId ?? ""}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const list = out.get(r.creatorProfileId) ?? [];
    list.push(r);
    out.set(r.creatorProfileId, list);
  }
  return out;
}

/** Full profile. Private profiles are visible to the owner, admins and brands they applied to. */
export async function getCreatorProfile(db: Executor, actor: Actor, creatorProfileId: string) {
  assertUuid(creatorProfileId, "Creator");
  const [p] = await db.select().from(creatorProfiles).where(eq(creatorProfiles.id, creatorProfileId));
  if (!p) throw new NotFoundError("Creator");
  const isOwner = actor.creatorProfileId === p.id;
  if (p.visibility === "private" && !isOwner && actor.role !== "admin") {
    const applied =
      actor.role === "brand" && actor.orgId
        ? await db
            .select({ id: applications.id })
            .from(applications)
            .innerJoin(campaigns, eq(applications.campaignId, campaigns.id))
            .where(and(eq(applications.creatorProfileId, p.id), eq(campaigns.organizationId, actor.orgId)))
            .limit(1)
        : [];
    if (applied.length === 0) throw new NotFoundError("Creator");
  }
  const [accounts, portfolio, rep, metrics, history] = await Promise.all([
    db.select().from(socialAccounts).where(eq(socialAccounts.creatorProfileId, p.id)),
    db.select().from(portfolioItems).where(eq(portfolioItems.creatorProfileId, p.id)).orderBy(desc(portfolioItems.createdAt)),
    reputationFor(db, [p.id]),
    latestMetrics(db, [p.id]),
    db
      .select({ agreement: agreements, campaign: campaigns, rating: reviews.rating, comment: reviews.comment })
      .from(agreements)
      .innerJoin(campaigns, eq(agreements.campaignId, campaigns.id))
      .leftJoin(reviews, eq(reviews.agreementId, agreements.id))
      .where(and(eq(agreements.creatorProfileId, p.id), eq(agreements.status, "completed"))),
  ]);
  const verifiedByCampaign = await db
    .select({ campaignId: attributionEvents.campaignId, n: sql<number>`count(*)::int` })
    .from(attributionEvents)
    .where(and(eq(attributionEvents.creatorProfileId, p.id), eq(attributionEvents.validityState, "valid"), sql`${attributionEvents.eventType} <> 'click'`))
    .groupBy(attributionEvents.campaignId);
  return {
    profile: p,
    isOwner,
    accounts,
    portfolio,
    reputation: rep.get(p.id)!,
    metrics: metrics.get(p.id) ?? [],
    history: history.map((h) => ({ ...h, verified: verifiedByCampaign.find((v) => v.campaignId === h.campaign.id)?.n ?? 0 })),
  };
}

export async function updateProfile(
  db: Executor,
  actor: Actor,
  input: {
    displayName: string;
    headline: string;
    bio: string;
    location: string;
    languages: string[];
    niches: string[];
    audienceBand: string;
    rateMinMinor: number;
    rateMaxMinor: number;
    availability: string;
    visibility: "public" | "private";
  },
) {
  requireCreator(actor);
  if (input.displayName.trim().length < 2) throw new DomainError("Add your name");
  if (input.niches.length === 0) throw new DomainError("Choose at least one niche");
  if (input.rateMaxMinor && input.rateMinMinor > input.rateMaxMinor) throw new DomainError("Minimum rate can't exceed maximum rate");
  if (!AUDIENCE_BANDS.includes(input.audienceBand)) throw new DomainError("Choose an audience size");
  await db
    .update(creatorProfiles)
    .set({ ...input, primaryNiche: input.niches[0]!, updatedAt: new Date() })
    .where(eq(creatorProfiles.id, actor.creatorProfileId));
  await audit(db, actor, "creator_profile", actor.creatorProfileId, "updated");
}

/** Manual evidence path: creator-reported numbers, labelled as such everywhere. */
export async function addManualAccount(db: Executor, actor: Actor, input: { platform: string; handle: string; followers: number; engagementRate: number; evidenceUrl: string }) {
  requireCreator(actor);
  if (!CHANNELS.includes(input.platform)) throw new DomainError("Choose a platform");
  const handle = input.handle.trim().replace(/^@/, "");
  if (!/^[A-Za-z0-9._-]{2,40}$/.test(handle)) throw new DomainError("Enter a valid handle");
  if (!Number.isSafeInteger(input.followers) || input.followers < 0) throw new DomainError("Enter your follower count");
  if (!/^https:\/\//.test(input.evidenceUrl)) throw new DomainError("Link a screenshot or export as evidence (https://)");
  const [acct] = await db
    .insert(socialAccounts)
    .values({ creatorProfileId: actor.creatorProfileId, platform: input.platform, handle, connectionState: "manual_evidence", connectedAt: new Date() })
    .returning();
  const now = new Date();
  await db.insert(metricSnapshots).values([
    { creatorProfileId: actor.creatorProfileId, socialAccountId: acct!.id, metricKey: "followers", valueNumeric: input.followers, source: `creator_upload:${input.evidenceUrl}`, verificationStatus: "creator_reported", observedAt: now },
    { creatorProfileId: actor.creatorProfileId, socialAccountId: acct!.id, metricKey: "engagement_rate_bp", valueNumeric: Math.round(input.engagementRate * 100), unit: "basis_points", source: `creator_upload:${input.evidenceUrl}`, verificationStatus: "creator_reported", observedAt: now },
  ]);
  await audit(db, actor, "social_account", acct!.id, "manual_added", { platform: input.platform });
}

/** Disconnect revokes access and stops showing the account's metrics as current. */
export async function disconnectAccount(db: Executor, actor: Actor, accountId: string) {
  requireCreator(actor);
  assertUuid(accountId, "Account");
  const [a] = await db.select().from(socialAccounts).where(eq(socialAccounts.id, accountId));
  if (!a || a.creatorProfileId !== actor.creatorProfileId) throw new NotFoundError("Account");
  await db
    .update(socialAccounts)
    .set({ connectionState: "disconnected", tokenSecretRef: null, scopes: [], disconnectedAt: new Date() })
    .where(eq(socialAccounts.id, a.id));
  await db.update(metricSnapshots).set({ verificationStatus: "stale" }).where(eq(metricSnapshots.socialAccountId, a.id));
  await audit(db, actor, "social_account", a.id, "disconnected", { platform: a.platform });
}

export async function addPortfolioItem(db: Executor, actor: Actor, input: { title: string; url: string; platform: string; brandName: string; resultSummary: string }) {
  requireCreator(actor);
  if (input.title.trim().length < 3) throw new DomainError("Add a title");
  if (!/^https:\/\//.test(input.url)) throw new DomainError("Link must start with https://");
  await db.insert(portfolioItems).values({
    creatorProfileId: actor.creatorProfileId,
    title: input.title.trim(),
    url: input.url.trim(),
    platform: input.platform,
    brandName: input.brandName.trim() || null,
    resultSummary: input.resultSummary.trim() || null,
  });
}

/** Advisory, explainable match signals. Never used to auto-reject anyone. */
export function matchReasons(
  campaign: { niche: string; channels: string[]; audience: { locations: string[]; languages: string[] }; compensation: { model: string } },
  creator: { niches: string[]; location: string; languages: string[]; rateMinMinor: number },
  accounts: { platform: string; connectionState: string }[],
  rep: Reputation | undefined,
): { label: string; positive: boolean }[] {
  const out: { label: string; positive: boolean }[] = [];
  out.push(creator.niches.includes(campaign.niche) ? { label: `Creates ${campaign.niche} content`, positive: true } : { label: `Niche differs (${creator.niches[0] ?? "—"})`, positive: false });
  const live = accounts.filter((a) => a.connectionState !== "disconnected").map((a) => a.platform);
  const shared = campaign.channels.filter((c) => live.includes(c));
  out.push(shared.length ? { label: `Active on ${shared.join(", ")}`, positive: true } : { label: "No matching channel connected", positive: false });
  const city = creator.location.split(",")[0]?.trim() ?? "";
  if (campaign.audience.locations.length && !campaign.audience.locations.includes("Pan-India"))
    out.push(campaign.audience.locations.some((l) => l === city) ? { label: `Based in ${city}`, positive: true } : { label: "Outside target cities", positive: false });
  const lang = campaign.audience.languages.filter((l) => creator.languages.includes(l));
  if (lang.length) out.push({ label: `Speaks ${lang.join(", ")}`, positive: true });
  if (rep && rep.completed > 0) out.push({ label: `${rep.completed} completed collaboration${rep.completed > 1 ? "s" : ""}`, positive: true });
  if (rep && rep.onTimeRate !== null) out.push({ label: `${Math.round(rep.onTimeRate * 100)}% on-time delivery`, positive: rep.onTimeRate >= 0.8 });
  return out;
}

