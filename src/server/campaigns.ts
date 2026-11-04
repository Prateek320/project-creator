import { and, desc, eq, ilike, inArray, lt, or, sql, type SQL } from "drizzle-orm";
import * as schema from "@/db/schema";
import { maxPayout, validateFormula } from "@/domain/compensation";
import { fundingLines } from "@/domain/ledger";
import { assertTransition, campaignMachine } from "@/domain/state";
import { DomainError, type CampaignAudience, type Formula, type MeasurementPlan } from "@/domain/types";
import { audit, getOwnedCampaign, postLedger, requireBrand, type Actor, type Executor, NotFoundError, assertUuid } from "./core";
import { getPaymentProvider } from "./providers";

const { campaigns, campaignRequirements, organizations, applications } = schema;

export interface CampaignInput {
  title: string;
  brief: string;
  objective: string;
  niche: string;
  channels: string[];
  audience: CampaignAudience;
  budgetMinor: number;
  creatorSlots: number;
  compensation: Formula;
  measurement: MeasurementPlan;
  rights: string;
  landingUrl: string;
  startAt: Date;
  endAt: Date;
  applyBy: Date | null;
  visibility: "public" | "private";
  requirements: { channel: string; deliverableType: string; quantity: number; dueOffsetDays: number; acceptanceCriteria: string }[];
}

function validateInput(i: CampaignInput) {
  if (i.title.trim().length < 4) throw new DomainError("Give the campaign a title (at least 4 characters)");
  if (i.brief.trim().length < 20) throw new DomainError("Describe the brief in at least 20 characters");
  if (!Number.isSafeInteger(i.budgetMinor) || i.budgetMinor <= 0) throw new DomainError("Set a budget greater than zero");
  if (i.creatorSlots < 1 || i.creatorSlots > 50) throw new DomainError("Creator slots must be between 1 and 50");
  if (i.channels.length === 0) throw new DomainError("Choose at least one channel");
  if (Number.isNaN(i.startAt.getTime()) || Number.isNaN(i.endAt.getTime())) throw new DomainError("Set valid campaign dates");
  if (i.endAt < i.startAt) throw new DomainError("End date must be after the start date");
  if (i.requirements.length === 0) throw new DomainError("Add at least one deliverable");
  for (const r of i.requirements) {
    if (r.quantity < 1 || r.quantity > 20) throw new DomainError("Deliverable quantity must be 1–20");
  }
  if (!/^https?:\/\//.test(i.landingUrl)) throw new DomainError("Landing page must be an http(s) URL");
  validateFormula(i.compensation);
}

export async function createCampaign(db: Executor, actor: Actor, input: CampaignInput, publish = false) {
  requireBrand(actor);
  validateInput(input);
  return db.transaction(async (tx) => {
    const [c] = await tx
      .insert(campaigns)
      .values({
        organizationId: actor.orgId,
        title: input.title.trim(),
        brief: input.brief.trim(),
        objective: input.objective,
        niche: input.niche,
        channels: input.channels,
        audience: input.audience,
        budgetMinor: input.budgetMinor,
        creatorSlots: input.creatorSlots,
        compensation: input.compensation,
        measurement: input.measurement,
        rights: input.rights,
        landingUrl: input.landingUrl,
        startAt: input.startAt,
        endAt: input.endAt,
        applyBy: input.applyBy,
        visibility: input.visibility,
      })
      .returning();
    if (!c) throw new Error("insert failed");
    await tx.insert(campaignRequirements).values(input.requirements.map((r) => ({ ...r, campaignId: c.id })));
    await audit(tx, actor, "campaign", c.id, "created", { title: c.title });
    if (publish) await publishCampaign(tx, actor, c.id);
    return c;
  });
}

/** Material terms must be complete and the budget must cover the worst-case payout before publishing. */
export async function publishCampaign(db: Executor, actor: Actor, campaignId: string) {
  requireBrand(actor);
  const c = await getOwnedCampaign(db, actor, campaignId);
  assertTransition(campaignMachine, "campaign", c.status, "published");
  const reqs = await db.select().from(campaignRequirements).where(eq(campaignRequirements.campaignId, c.id));
  if (reqs.length === 0) throw new DomainError("Add at least one deliverable before publishing");
  if (!c.rights.trim()) throw new DomainError("State content usage rights before publishing");
  if (!c.measurement.validDefinition.trim()) throw new DomainError("Define what counts as a valid outcome before publishing");
  const worstCase = maxPayout(c.compensation, c.measurement.target) * c.creatorSlots;
  if (c.compensation.model !== "fixed" && c.compensation.capMinor === undefined)
    throw new DomainError("Performance pricing needs a per-creator cap so the budget is bounded");
  if (worstCase > c.budgetMinor)
    throw new DomainError("Budget doesn't cover the maximum payout for every creator slot. Raise the budget, lower the cap or reduce slots.");
  await db
    .update(campaigns)
    .set({ status: "published", publishedAt: new Date(), updatedAt: new Date() })
    .where(eq(campaigns.id, c.id));
  await audit(db, actor, "campaign", c.id, "published", { version: c.version });
}

export async function transitionCampaign(
  db: Executor,
  actor: Actor,
  campaignId: string,
  to: "paused" | "published" | "completed" | "cancelled",
) {
  requireBrand(actor);
  const c = await getOwnedCampaign(db, actor, campaignId);
  if (to === "published" && c.status === "draft") return publishCampaign(db, actor, campaignId);
  assertTransition(campaignMachine, "campaign", c.status, to);
  await db.update(campaigns).set({ status: to, updatedAt: new Date() }).where(eq(campaigns.id, c.id));
  if (to === "cancelled" || to === "completed") {
    // Close out applications that never progressed.
    await db
      .update(applications)
      .set({ status: "expired", updatedAt: new Date() })
      .where(and(eq(applications.campaignId, c.id), inArray(applications.status, ["submitted", "shortlisted"])));
  }
  await audit(db, actor, "campaign", c.id, to);
}

/** Funds the campaign through the (mock) payment provider. Idempotent per campaign. */
export async function fundCampaign(db: Executor, actor: Actor, campaignId: string) {
  requireBrand(actor);
  const c = await getOwnedCampaign(db, actor, campaignId);
  if (c.fundingState === "funded") return;
  if (c.status === "cancelled" || c.status === "draft") throw new DomainError("Publish the campaign before funding it");
  const provider = getPaymentProvider();
  const key = `fund:${c.id}`;
  const res = await provider.collect({ idempotencyKey: key, amountMinor: c.budgetMinor, currency: c.currency });
  await db.transaction(async (tx) => {
    await postLedger(tx, {
      idempotencyKey: key,
      campaignId: c.id,
      entryType: "funding",
      lines: fundingLines(c.budgetMinor),
      referenceType: "provider_order",
      referenceId: res.providerRef,
      memo: `Campaign funded via ${provider.name} provider (test mode)`,
    });
    await tx.update(campaigns).set({ fundingState: "funded" }).where(eq(campaigns.id, c.id));
    await audit(tx, actor, "campaign", c.id, "funded", { providerRef: res.providerRef, amountMinor: c.budgetMinor });
  });
}

export async function listBrandCampaigns(db: Executor, actor: Actor) {
  requireBrand(actor);
  const rows = await db
    .select({
      campaign: campaigns,
      applicants: sql<number>`(select count(*)::int from applications a where a.campaign_id = campaigns.id)`,
      accepted: sql<number>`(select count(*)::int from agreements g where g.campaign_id = campaigns.id and g.status in ('accepted','disputed','completed'))`,
    })
    .from(campaigns)
    .where(eq(campaigns.organizationId, actor.orgId))
    .orderBy(desc(campaigns.createdAt));
  return rows;
}

export async function getRequirements(db: Executor, campaignId: string) {
  return db.select().from(campaignRequirements).where(eq(campaignRequirements.campaignId, campaignId));
}

export interface DiscoverFilters {
  q?: string;
  niche?: string;
  channel?: string;
  model?: string;
  cursor?: string;
  limit?: number;
}

/** Server-side filtered, cursor-paginated discovery of public, published campaigns. */
export async function discoverCampaigns(db: Executor, f: DiscoverFilters) {
  const limit = Math.min(Math.max(f.limit ?? 12, 1), 50);
  const conds: SQL[] = [eq(campaigns.status, "published"), eq(campaigns.visibility, "public")];
  if (f.q) {
    const q = `%${f.q.slice(0, 80)}%`;
    const m = or(ilike(campaigns.title, q), ilike(campaigns.brief, q), ilike(organizations.displayName, q));
    if (m) conds.push(m);
  }
  if (f.niche) conds.push(eq(campaigns.niche, f.niche));
  if (f.channel) conds.push(sql`${campaigns.channels} ? ${f.channel}`);
  if (f.model) conds.push(sql`${campaigns.compensation}->>'model' = ${f.model}`);
  if (f.cursor) {
    const [ts, cid] = Buffer.from(f.cursor, "base64url").toString().split("|");
    if (ts && cid) {
      const d = new Date(ts);
      const c = or(lt(campaigns.publishedAt, d), and(eq(campaigns.publishedAt, d), lt(campaigns.id, cid)));
      if (c) conds.push(c);
    }
  }
  const rows = await db
    .select({ campaign: campaigns, brand: organizations })
    .from(campaigns)
    .innerJoin(organizations, eq(campaigns.organizationId, organizations.id))
    .where(and(...conds))
    .orderBy(desc(campaigns.publishedAt), desc(campaigns.id))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  const nextCursor =
    rows.length > limit && last?.campaign.publishedAt
      ? Buffer.from(`${last.campaign.publishedAt.toISOString()}|${last.campaign.id}`).toString("base64url")
      : null;
  return { items: page, nextCursor };
}

/** A campaign as a creator sees it: only published/public (or one they're already involved in). */
export async function getCampaignForCreator(db: Executor, actor: Actor, campaignId: string) {
  assertUuid(campaignId, "Campaign");
  const [row] = await db
    .select({ campaign: campaigns, brand: organizations })
    .from(campaigns)
    .innerJoin(organizations, eq(campaigns.organizationId, organizations.id))
    .where(eq(campaigns.id, campaignId))
    .limit(1);
  if (!row) throw new NotFoundError("Campaign");
  const visible = row.campaign.status !== "draft" && (row.campaign.visibility === "public" || actor.role === "admin");
  if (!visible) {
    const mine = actor.creatorProfileId
      ? await db
          .select({ id: applications.id })
          .from(applications)
          .where(and(eq(applications.campaignId, campaignId), eq(applications.creatorProfileId, actor.creatorProfileId)))
      : [];
    if (mine.length === 0) throw new NotFoundError("Campaign");
  }
  return row;
}
