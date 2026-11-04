/** Trust & operations: queues, verification, audit trail, reviews, notifications. */
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import { DomainError } from "@/domain/types";
import { getCollaboration } from "./collaborations";
import { assertUuid, audit, NotFoundError, requireAdmin, requireBrand, type Actor, type Executor } from "./core";

const { disputes, agreements, campaigns, creatorProfiles, organizations, attributionEvents, paymentTransfers, auditEvents, users, reviews, notifications } =
  schema;

export async function adminQueue(db: Executor, actor: Actor) {
  requireAdmin(actor);
  const [openDisputes, invalidEvents, failedTransfers, pendingCreators, pendingOrgs] = await Promise.all([
    db
      .select({ dispute: disputes, agreement: agreements, campaign: campaigns, creator: creatorProfiles, opener: users })
      .from(disputes)
      .innerJoin(agreements, eq(disputes.agreementId, agreements.id))
      .innerJoin(campaigns, eq(agreements.campaignId, campaigns.id))
      .innerJoin(creatorProfiles, eq(agreements.creatorProfileId, creatorProfiles.id))
      .innerJoin(users, eq(disputes.openedByUserId, users.id))
      .where(inArray(disputes.state, ["open", "under_review"]))
      .orderBy(disputes.createdAt),
    db
      .select({ event: attributionEvents, campaign: campaigns, creator: creatorProfiles })
      .from(attributionEvents)
      .innerJoin(campaigns, eq(attributionEvents.campaignId, campaigns.id))
      .innerJoin(creatorProfiles, eq(attributionEvents.creatorProfileId, creatorProfiles.id))
      .where(inArray(attributionEvents.validityState, ["invalid", "out_of_window"]))
      .orderBy(desc(attributionEvents.receivedAt))
      .limit(25),
    db.select().from(paymentTransfers).where(eq(paymentTransfers.state, "failed")),
    db.select().from(creatorProfiles).where(eq(creatorProfiles.verificationState, "pending")),
    db.select().from(organizations).where(eq(organizations.verificationState, "pending")),
  ]);
  return { openDisputes, invalidEvents, failedTransfers, pendingCreators, pendingOrgs };
}

export async function getDispute(db: Executor, actor: Actor, disputeId: string) {
  requireAdmin(actor);
  assertUuid(disputeId, "Dispute");
  const [d] = await db.select().from(disputes).where(eq(disputes.id, disputeId));
  if (!d) throw new NotFoundError("Dispute");
  const trail = await db
    .select()
    .from(auditEvents)
    .where(and(eq(auditEvents.entityType, "dispute"), eq(auditEvents.entityId, d.id)))
    .orderBy(auditEvents.createdAt);
  return { dispute: d, trail };
}

export async function setVerification(
  db: Executor,
  actor: Actor,
  kind: "creator" | "organization",
  id: string,
  to: "verified" | "rejected",
  reason: string,
) {
  requireAdmin(actor);
  assertUuid(id);
  if (reason.trim().length < 5) throw new DomainError("A reason is required");
  if (kind === "creator") await db.update(creatorProfiles).set({ verificationState: to }).where(eq(creatorProfiles.id, id));
  else await db.update(organizations).set({ verificationState: to }).where(eq(organizations.id, id));
  await audit(db, actor, kind, id, `verification_${to}`, {}, reason);
}

export async function auditTrail(db: Executor, actor: Actor, limit = 100) {
  requireAdmin(actor);
  return db
    .select({ event: auditEvents, actorName: users.name })
    .from(auditEvents)
    .leftJoin(users, eq(auditEvents.actorUserId, users.id))
    .orderBy(desc(auditEvents.createdAt))
    .limit(limit);
}

/** Structured, moderated review left by the brand after completion. */
export async function leaveReview(
  db: Executor,
  actor: Actor,
  rootAgreementId: string,
  input: { rating: number; quality: number; communication: number; timeliness: number; comment: string },
) {
  requireBrand(actor);
  const collab = await getCollaboration(db, actor, rootAgreementId);
  if (collab.active?.status !== "completed") throw new DomainError("Reviews open once the collaboration is completed");
  for (const v of [input.rating, input.quality, input.communication, input.timeliness])
    if (!Number.isInteger(v) || v < 1 || v > 5) throw new DomainError("Ratings must be 1–5");
  const [existing] = await db
    .select({ id: reviews.id })
    .from(reviews)
    .where(and(eq(reviews.agreementId, collab.root.id), eq(reviews.reviewerUserId, actor.userId)));
  if (existing) throw new DomainError("You've already reviewed this collaboration");
  await db.insert(reviews).values({
    agreementId: collab.root.id,
    reviewerUserId: actor.userId,
    rating: input.rating,
    structuredFeedback: { quality: input.quality, communication: input.communication, timeliness: input.timeliness },
    comment: input.comment.trim() || null,
  });
  await audit(db, actor, "agreement", collab.root.id, "reviewed", { rating: input.rating });
}

export async function getReview(db: Executor, rootAgreementId: string) {
  const [r] = await db.select().from(reviews).where(eq(reviews.agreementId, rootAgreementId)).limit(1);
  return r ?? null;
}

export async function listNotifications(db: Executor, actor: Actor) {
  const rows = await db.select().from(notifications).where(eq(notifications.userId, actor.userId)).orderBy(desc(notifications.createdAt)).limit(30);
  const [unread] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, actor.userId), isNull(notifications.readAt)));
  return { rows, unread: unread?.n ?? 0 };
}

export async function markNotificationsRead(db: Executor, actor: Actor) {
  await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, actor.userId), isNull(notifications.readAt)));
}
