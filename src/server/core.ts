/** Cross-cutting service helpers: actor, authorization, audit, notifications, ledger posting. */
import { and, eq, inArray } from "drizzle-orm";
import type { DB, Tx } from "@/db";
import * as schema from "@/db/schema";
import { assertBalanced, type LedgerLine } from "@/domain/ledger";
import { DomainError } from "@/domain/types";

const { users, memberships, creatorProfiles, campaigns, agreements, auditEvents, notifications, ledgerEntries } = schema;

export type Executor = DB | Tx;

export interface Actor {
  userId: string;
  role: "brand" | "creator" | "admin";
  name: string;
  email: string;
  orgId: string | null;
  creatorProfileId: string | null;
}

export class NotFoundError extends DomainError {
  constructor(what = "Item") {
    // Same message for "missing" and "not yours" so tenants cannot probe each other's IDs.
    super(`${what} not found`, "not_found");
  }
}
export class ForbiddenError extends DomainError {
  constructor(message = "You don't have permission to do that") {
    super(message, "forbidden");
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function assertUuid(id: string, what = "Item"): void {
  if (!UUID_RE.test(id)) throw new NotFoundError(what);
}

export async function loadActor(db: Executor, userId: string): Promise<Actor | null> {
  if (!UUID_RE.test(userId)) return null;
  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!u || u.status !== "active") return null;
  const [m] = await db.select().from(memberships).where(eq(memberships.userId, u.id)).limit(1);
  const [cp] = await db.select({ id: creatorProfiles.id }).from(creatorProfiles).where(eq(creatorProfiles.userId, u.id)).limit(1);
  return { userId: u.id, role: u.role, name: u.name, email: u.email, orgId: m?.organizationId ?? null, creatorProfileId: cp?.id ?? null };
}

export function requireBrand(a: Actor): asserts a is Actor & { orgId: string } {
  if (a.role !== "brand" || !a.orgId) throw new ForbiddenError("Only brand team members can do that");
}
export function requireCreator(a: Actor): asserts a is Actor & { creatorProfileId: string } {
  if (a.role !== "creator" || !a.creatorProfileId) throw new ForbiddenError("Only creators can do that");
}
export function requireAdmin(a: Actor): void {
  if (a.role !== "admin") throw new ForbiddenError("Only platform operations can do that");
}

/** Brand-owned campaign (tenant isolation). Admins can read any campaign. */
export async function getOwnedCampaign(db: Executor, actor: Actor, campaignId: string) {
  assertUuid(campaignId, "Campaign");
  const [c] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId)).limit(1);
  if (!c) throw new NotFoundError("Campaign");
  if (actor.role === "admin") return c;
  if (actor.role !== "brand" || c.organizationId !== actor.orgId) throw new NotFoundError("Campaign");
  return c;
}

/** Agreement visible to: the creator party, the owning brand, or admins. */
export async function getAgreementForActor(db: Executor, actor: Actor, agreementId: string) {
  assertUuid(agreementId, "Collaboration");
  const [row] = await db
    .select({ agreement: agreements, campaign: campaigns })
    .from(agreements)
    .innerJoin(campaigns, eq(agreements.campaignId, campaigns.id))
    .where(eq(agreements.id, agreementId))
    .limit(1);
  if (!row) throw new NotFoundError("Collaboration");
  const isCreator = actor.role === "creator" && row.agreement.creatorProfileId === actor.creatorProfileId;
  const isBrand = actor.role === "brand" && row.campaign.organizationId === actor.orgId;
  if (!isCreator && !isBrand && actor.role !== "admin") throw new NotFoundError("Collaboration");
  return { ...row, side: isCreator ? ("creator" as const) : isBrand ? ("brand" as const) : ("admin" as const) };
}

export async function audit(
  db: Executor,
  actor: Actor | null,
  entityType: string,
  entityId: string,
  action: string,
  payload: Record<string, unknown> = {},
  reason?: string,
) {
  await db.insert(auditEvents).values({ actorUserId: actor?.userId ?? null, entityType, entityId, action, payload, reason });
}

export async function notify(db: Executor, userIds: string[], title: string, body: string, href?: string) {
  const unique = [...new Set(userIds)].filter(Boolean);
  if (unique.length === 0) return;
  await db.insert(notifications).values(unique.map((userId) => ({ userId, title, body, href })));
}

export async function brandUserIds(db: Executor, orgId: string): Promise<string[]> {
  const rows = await db.select({ id: memberships.userId }).from(memberships).where(eq(memberships.organizationId, orgId));
  return rows.map((r) => r.id);
}
export async function creatorUserId(db: Executor, creatorProfileId: string): Promise<string> {
  const [r] = await db.select({ id: creatorProfiles.userId }).from(creatorProfiles).where(eq(creatorProfiles.id, creatorProfileId));
  return r?.id ?? "";
}

/**
 * Append a balanced ledger transaction. Idempotent: if the idempotency key was already used,
 * nothing is written and `false` is returned.
 */
export async function postLedger(
  db: Executor,
  p: {
    idempotencyKey: string;
    campaignId: string;
    agreementId?: string | null;
    creatorProfileId?: string | null;
    entryType: string;
    lines: LedgerLine[];
    referenceType?: string;
    referenceId?: string;
    memo: string;
  },
): Promise<{ written: boolean; groupId: string }> {
  assertBalanced(p.lines);
  const keys = p.lines.map((_, i) => `${p.idempotencyKey}#${i}`);
  const groupId = crypto.randomUUID();
  // One insert that tolerates a concurrent duplicate: the unique idempotency key decides the winner,
  // and the loser reads back the winner's group instead of throwing.
  const inserted = await db
    .insert(ledgerEntries)
    .values(
      p.lines.map((l, i) => ({
        transactionGroupId: groupId,
        campaignId: p.campaignId,
        agreementId: p.agreementId ?? null,
        creatorProfileId: p.creatorProfileId ?? null,
        account: l.account,
        entryType: p.entryType,
        amountMinor: l.amountMinor,
        idempotencyKey: keys[i]!,
        referenceType: p.referenceType,
        referenceId: p.referenceId,
        memo: p.memo,
      })),
    )
    .onConflictDoNothing({ target: ledgerEntries.idempotencyKey })
    .returning({ id: ledgerEntries.id });
  if (inserted.length === p.lines.length) return { written: true, groupId };
  if (inserted.length > 0) throw new Error(`Ledger idempotency key ${p.idempotencyKey} partially collided; transaction aborted`);
  const [existing] = await db
    .select({ group: ledgerEntries.transactionGroupId })
    .from(ledgerEntries)
    .where(inArray(ledgerEntries.idempotencyKey, keys))
    .limit(1);
  return { written: false, groupId: existing!.group };
}

export async function ledgerFor(db: Executor, where: { campaignId?: string; agreementId?: string }) {
  const conds = [];
  if (where.campaignId) conds.push(eq(ledgerEntries.campaignId, where.campaignId));
  if (where.agreementId) conds.push(eq(ledgerEntries.agreementId, where.agreementId));
  return db.select().from(ledgerEntries).where(and(...conds)).orderBy(ledgerEntries.createdAt);
}
