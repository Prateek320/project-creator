/** Applications → offers → versioned agreements → deliverables. */
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import * as schema from "@/db/schema";
import { validateFormula } from "@/domain/compensation";
import { applicationMachine, agreementMachine, assertTransition, deliverableMachine, MAX_REVISIONS } from "@/domain/state";
import { DomainError, type Formula } from "@/domain/types";
import {
  assertUuid,
  audit,
  brandUserIds,
  creatorUserId,
  ForbiddenError,
  getAgreementForActor,
  getOwnedCampaign,
  NotFoundError,
  notify,
  requireBrand,
  requireCreator,
  type Actor,
  type Executor,
} from "./core";
import { getRequirements } from "./campaigns";

const { applications, agreements, deliverables, campaigns, creatorProfiles, milestones } = schema;
const DAY = 86_400_000;
const ACTIVE = ["accepted", "disputed", "completed"] as const;

/** Current status of a collaboration thread: the active version if any, else the newest live one. */
const threadStatus = sql<string>`(select g2.status from agreements g2
  where g2.campaign_id = agreements.campaign_id and g2.creator_profile_id = agreements.creator_profile_id
    and g2.status not in ('cancelled','superseded')
  order by (g2.status in ('accepted','disputed','completed')) desc, g2.version desc limit 1)`;

// ---------------- applications ----------------

export async function applyToCampaign(
  db: Executor,
  actor: Actor,
  campaignId: string,
  input: { pitch: string; proposedRateMinor: number; availability: string; portfolioLinks: string[] },
) {
  requireCreator(actor);
  assertUuid(campaignId, "Campaign");
  const [c] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId));
  if (!c || c.status === "draft" || c.visibility !== "public") throw new NotFoundError("Campaign");
  if (c.status !== "published") throw new DomainError("This campaign is not accepting applications");
  if (c.applyBy && c.applyBy < new Date()) throw new DomainError("Applications for this campaign have closed");
  const [me] = await db.select({ niches: creatorProfiles.niches }).from(creatorProfiles).where(eq(creatorProfiles.id, actor.creatorProfileId));
  if (!me?.niches.length) throw new DomainError("Complete your profile (niches and audience) before applying");
  if (input.pitch.trim().length < 30) throw new DomainError("Write a pitch of at least 30 characters so the brand can evaluate fit");
  if (!Number.isSafeInteger(input.proposedRateMinor) || input.proposedRateMinor < 0) throw new DomainError("Enter a valid rate");
  const links = input.portfolioLinks.filter((l) => /^https?:\/\//.test(l)).slice(0, 5);
  const [existing] = await db
    .select({ id: applications.id })
    .from(applications)
    .where(and(eq(applications.campaignId, campaignId), eq(applications.creatorProfileId, actor.creatorProfileId)));
  if (existing) throw new DomainError("You've already applied to this campaign");
  const [app] = await db
    .insert(applications)
    .values({
      campaignId,
      creatorProfileId: actor.creatorProfileId,
      pitch: input.pitch.trim(),
      proposedRateMinor: input.proposedRateMinor,
      availability: input.availability.trim(),
      portfolioLinks: links,
    })
    .returning();
  await audit(db, actor, "application", app!.id, "submitted", { campaignId });
  await notify(db, await brandUserIds(db, c.organizationId), "New application", `${actor.name} applied to ${c.title}`, `/brand/campaigns/${c.id}/applications`);
  return app!;
}

export async function withdrawApplication(db: Executor, actor: Actor, applicationId: string) {
  requireCreator(actor);
  assertUuid(applicationId, "Application");
  const [a] = await db.select().from(applications).where(eq(applications.id, applicationId));
  if (!a || a.creatorProfileId !== actor.creatorProfileId) throw new NotFoundError("Application");
  assertTransition(applicationMachine, "application", a.status, "withdrawn");
  await db.update(applications).set({ status: "withdrawn", updatedAt: new Date() }).where(eq(applications.id, a.id));
  // An open offer on a withdrawn application is cancelled.
  await db.update(agreements).set({ status: "cancelled" }).where(and(eq(agreements.applicationId, a.id), eq(agreements.status, "offered")));
  await audit(db, actor, "application", a.id, "withdrawn");
}

async function ownedApplication(db: Executor, actor: Actor, applicationId: string) {
  requireBrand(actor);
  assertUuid(applicationId, "Application");
  const [row] = await db
    .select({ app: applications, campaign: campaigns })
    .from(applications)
    .innerJoin(campaigns, eq(applications.campaignId, campaigns.id))
    .where(eq(applications.id, applicationId));
  if (!row || row.campaign.organizationId !== actor.orgId) throw new NotFoundError("Application");
  return row;
}

export async function setApplicationStatus(
  db: Executor,
  actor: Actor,
  applicationId: string,
  to: "shortlisted" | "rejected",
  note?: string,
) {
  const { app, campaign } = await ownedApplication(db, actor, applicationId);
  assertTransition(applicationMachine, "application", app.status, to);
  await db
    .update(applications)
    .set({ status: to, brandNote: note?.trim() || app.brandNote, updatedAt: new Date() })
    .where(eq(applications.id, app.id));
  await audit(db, actor, "application", app.id, to, { note });
  await notify(
    db,
    [await creatorUserId(db, app.creatorProfileId)],
    to === "shortlisted" ? "You've been shortlisted" : "Application update",
    to === "shortlisted" ? `${campaign.title}: the brand shortlisted your application` : `${campaign.title}: the brand went with other creators this time`,
    "/creator/applications",
  );
}

/** Applications for a brand-owned campaign, joined with creator data for side-by-side comparison. */
export async function listCampaignApplications(db: Executor, actor: Actor, campaignId: string) {
  const c = await getOwnedCampaign(db, actor, campaignId);
  const rows = await db
    .select({ app: applications, creator: creatorProfiles })
    .from(applications)
    .innerJoin(creatorProfiles, eq(applications.creatorProfileId, creatorProfiles.id))
    .where(eq(applications.campaignId, c.id))
    .orderBy(asc(applications.createdAt));
  return { campaign: c, rows };
}

export async function listCreatorApplications(db: Executor, actor: Actor) {
  requireCreator(actor);
  return db
    .select({ app: applications, campaign: campaigns })
    .from(applications)
    .innerJoin(campaigns, eq(applications.campaignId, campaigns.id))
    .where(eq(applications.creatorProfileId, actor.creatorProfileId))
    .orderBy(desc(applications.updatedAt));
}

// ---------------- offers & agreements ----------------

function trackingSlug() {
  return randomBytes(5).toString("base64url").toLowerCase().replace(/[^a-z0-9]/g, "x");
}

/** Brand issues an offer. The brand's acceptance of its own offer is recorded at creation. */
export async function makeOffer(
  db: Executor,
  actor: Actor,
  applicationId: string,
  terms: { formula: Formula; rights?: string; note?: string },
) {
  const { app, campaign } = await ownedApplication(db, actor, applicationId);
  assertTransition(applicationMachine, "application", app.status, "offered");
  if (campaign.status !== "published" && campaign.status !== "paused") throw new DomainError("Offers can only be made on live campaigns");
  validateFormula(terms.formula);
  const reqs = await getRequirements(db, campaign.id);
  const snapshot = reqs.flatMap((r) =>
    Array.from({ length: r.quantity }, (_, i) => ({
      title: `${r.deliverableType}${r.quantity > 1 ? ` ${i + 1} of ${r.quantity}` : ""}`,
      type: r.deliverableType,
      channel: r.channel,
      dueAt: new Date(campaign.startAt.getTime() + (r.dueOffsetDays + i * 2) * DAY).toISOString(),
    })),
  );
  const [cp] = await db.select().from(creatorProfiles).where(eq(creatorProfiles.id, app.creatorProfileId));
  const coupon = `${(cp?.displayName.split(" ")[0] ?? "CREATOR").toUpperCase().replace(/[^A-Z]/g, "")}${randomBytes(1)[0]! % 90 + 10}`;
  return db.transaction(async (tx) => {
    const [ag] = await tx
      .insert(agreements)
      .values({
        campaignId: campaign.id,
        creatorProfileId: app.creatorProfileId,
        applicationId: app.id,
        version: 1,
        compensationModel: terms.formula.model,
        formulaSnapshot: terms.formula,
        deliverablesSnapshot: snapshot,
        rights: terms.rights?.trim() || campaign.rights,
        changeSummary: terms.note?.trim() || "Initial offer",
        status: "offered",
        acceptedByBrandAt: new Date(),
        trackingSlug: trackingSlug(),
        couponCode: coupon,
      })
      .returning();
    await tx.update(applications).set({ status: "offered", updatedAt: new Date() }).where(eq(applications.id, app.id));
    await audit(tx, actor, "agreement", ag!.id, "offered", { version: 1, formula: terms.formula });
    await notify(tx, [await creatorUserId(tx, app.creatorProfileId)], "You have an offer", `${campaign.title}: review the agreement and accept to start`, `/collaborations/${ag!.id}`);
    return ag!;
  });
}

/** All versions of the agreement between one creator and one campaign. Root = version 1. */
export async function getCollaboration(db: Executor, actor: Actor, anyAgreementId: string) {
  const { agreement, campaign, side } = await getAgreementForActor(db, actor, anyAgreementId);
  const versions = await db
    .select()
    .from(agreements)
    .where(and(eq(agreements.campaignId, agreement.campaignId), eq(agreements.creatorProfileId, agreement.creatorProfileId)))
    .orderBy(asc(agreements.version));
  const root = versions[0]!;
  const active = [...versions].reverse().find((v) => (ACTIVE as readonly string[]).includes(v.status)) ?? null;
  const pending = versions.find((v) => v.status === "offered") ?? null;
  const items = await db.select().from(deliverables).where(eq(deliverables.agreementId, root.id)).orderBy(asc(deliverables.dueAt));
  const [creator] = await db.select().from(creatorProfiles).where(eq(creatorProfiles.id, agreement.creatorProfileId));
  const ms = await db.select().from(milestones).where(eq(milestones.agreementId, root.id));
  return { campaign, side, versions, root, active, pending, deliverables: items, creator: creator!, milestones: ms };
}

export async function acceptAgreement(db: Executor, actor: Actor, agreementId: string) {
  const { agreement, campaign, side } = await getAgreementForActor(db, actor, agreementId);
  if (side === "admin") throw new ForbiddenError("Only the brand or creator can accept an agreement");
  assertTransition(agreementMachine, "agreement", agreement.status, "accepted");
  const now = new Date();
  const patch = side === "creator" ? { acceptedByCreatorAt: now } : { acceptedByBrandAt: now };
  const bothAccepted =
    (side === "creator" ? now : agreement.acceptedByCreatorAt) !== null && (side === "brand" ? now : agreement.acceptedByBrandAt) !== null;

  await db.transaction(async (tx) => {
    await tx.update(agreements).set(patch).where(eq(agreements.id, agreement.id));
    await audit(tx, actor, "agreement", agreement.id, `accepted_by_${side}`, { version: agreement.version });
    if (!bothAccepted) return;

    const versions = await tx
      .select()
      .from(agreements)
      .where(and(eq(agreements.campaignId, agreement.campaignId), eq(agreements.creatorProfileId, agreement.creatorProfileId)))
      .orderBy(asc(agreements.version));
    const root = versions[0]!;
    // Previous active version is superseded — never edited.
    for (const v of versions) {
      if (v.id !== agreement.id && (v.status === "accepted" || v.status === "disputed")) {
        await tx.update(agreements).set({ status: "superseded" }).where(eq(agreements.id, v.id));
      }
    }
    const wasDisputed = versions.some((v) => v.id !== agreement.id && v.status === "disputed");
    await tx.update(agreements).set({ status: wasDisputed ? "disputed" : "accepted" }).where(eq(agreements.id, agreement.id));

    if (agreement.version === 1) {
      if (agreement.applicationId)
        await tx.update(applications).set({ status: "accepted", updatedAt: now }).where(eq(applications.id, agreement.applicationId));
      await tx.insert(deliverables).values(
        agreement.deliverablesSnapshot.map((d) => ({
          agreementId: root.id,
          title: d.title,
          type: d.type,
          channel: d.channel,
          dueAt: new Date(d.dueAt),
        })),
      );
      await tx.insert(milestones).values([
        { agreementId: root.id, milestoneType: "deliverable", label: "All deliverables approved" },
        ...(agreement.formulaSnapshot.model !== "fixed"
          ? [{ agreementId: root.id, milestoneType: "outcome", label: `Verified ${agreement.formulaSnapshot.outcomeEvent}s` }]
          : []),
      ]);
    } else {
      // Amendment: apply new due dates to deliverables that are not yet approved.
      const items = await tx.select().from(deliverables).where(eq(deliverables.agreementId, root.id)).orderBy(asc(deliverables.dueAt));
      for (const [i, d] of items.entries()) {
        const snap = agreement.deliverablesSnapshot[i];
        if (snap && d.approvalState !== "approved") await tx.update(deliverables).set({ dueAt: new Date(snap.dueAt) }).where(eq(deliverables.id, d.id));
      }
    }
    await audit(tx, actor, "agreement", agreement.id, "active", { version: agreement.version });
    const others = side === "creator" ? await brandUserIds(tx, campaign.organizationId) : [await creatorUserId(tx, agreement.creatorProfileId)];
    await notify(tx, others, agreement.version === 1 ? "Agreement accepted" : `Amendment v${agreement.version} accepted`, `${campaign.title}: both parties have accepted`, `/collaborations/${root.id}`);
  });
}

export async function declineAgreement(db: Executor, actor: Actor, agreementId: string, reason: string) {
  const { agreement, campaign, side } = await getAgreementForActor(db, actor, agreementId);
  if (side === "admin") throw new ForbiddenError();
  assertTransition(agreementMachine, "agreement", agreement.status, "cancelled");
  if (agreement.status !== "offered") throw new DomainError("Only a pending offer or amendment can be declined");
  await db.update(agreements).set({ status: "cancelled" }).where(eq(agreements.id, agreement.id));
  if (agreement.version === 1 && agreement.applicationId) {
    await db
      .update(applications)
      .set({ status: side === "creator" ? "withdrawn" : "rejected", updatedAt: new Date() })
      .where(eq(applications.id, agreement.applicationId));
  }
  await audit(db, actor, "agreement", agreement.id, `declined_by_${side}`, { version: agreement.version }, reason);
  const others = side === "creator" ? await brandUserIds(db, campaign.organizationId) : [await creatorUserId(db, agreement.creatorProfileId)];
  await notify(db, others, agreement.version === 1 ? "Offer declined" : "Amendment declined", `${campaign.title}: ${reason || "no reason given"}`, `/collaborations/${agreement.id}`);
}

/**
 * Propose changed terms. Creates a new version; the proposer's acceptance is recorded,
 * the other party must accept before it replaces the active version.
 */
export async function proposeAmendment(
  db: Executor,
  actor: Actor,
  agreementId: string,
  change: { formula: Formula; shiftDueDays: number; summary: string },
) {
  const collab = await getCollaboration(db, actor, agreementId);
  if (collab.side === "admin") throw new ForbiddenError();
  if (!collab.active) throw new DomainError("Amendments apply to an accepted agreement");
  if (collab.pending) throw new DomainError("There is already a pending change waiting for a response");
  if (collab.active.status === "completed") throw new DomainError("This collaboration is complete");
  if (change.summary.trim().length < 5) throw new DomainError("Describe what's changing and why");
  validateFormula(change.formula);
  if (!Number.isInteger(change.shiftDueDays) || Math.abs(change.shiftDueDays) > 60) throw new DomainError("Due-date shift must be within ±60 days");
  const nextVersion = Math.max(...collab.versions.map((v) => v.version)) + 1;
  const shifted = collab.active.deliverablesSnapshot.map((d, i) => {
    const current = collab.deliverables[i];
    const base = current ? current.dueAt.getTime() : new Date(d.dueAt).getTime();
    return { ...d, dueAt: new Date(base + change.shiftDueDays * DAY).toISOString() };
  });
  const now = new Date();
  const [ag] = await db
    .insert(agreements)
    .values({
      campaignId: collab.active.campaignId,
      creatorProfileId: collab.active.creatorProfileId,
      applicationId: collab.active.applicationId,
      version: nextVersion,
      compensationModel: change.formula.model,
      formulaSnapshot: change.formula,
      deliverablesSnapshot: shifted,
      rights: collab.active.rights,
      changeSummary: change.summary.trim(),
      status: "offered",
      acceptedByBrandAt: collab.side === "brand" ? now : null,
      acceptedByCreatorAt: collab.side === "creator" ? now : null,
      trackingSlug: collab.active.trackingSlug,
      couponCode: collab.active.couponCode,
    })
    .returning();
  await audit(db, actor, "agreement", ag!.id, "amendment_proposed", { version: nextVersion, summary: change.summary });
  const others =
    collab.side === "creator" ? await brandUserIds(db, collab.campaign.organizationId) : [await creatorUserId(db, collab.active.creatorProfileId)];
  await notify(db, others, `Amendment v${nextVersion} proposed`, change.summary, `/collaborations/${collab.root.id}`);
  return ag!;
}

// ---------------- deliverables ----------------

async function deliverableForActor(db: Executor, actor: Actor, deliverableId: string) {
  assertUuid(deliverableId, "Deliverable");
  const [d] = await db.select().from(deliverables).where(eq(deliverables.id, deliverableId));
  if (!d) throw new NotFoundError("Deliverable");
  const collab = await getCollaboration(db, actor, d.agreementId);
  return { d, collab };
}

export async function submitDeliverable(db: Executor, actor: Actor, deliverableId: string, url: string, notes: string) {
  requireCreator(actor);
  const { d, collab } = await deliverableForActor(db, actor, deliverableId);
  if (!collab.active || collab.active.status === "completed") throw new DomainError("This collaboration isn't active");
  if (!/^https:\/\/[^\s]+$/.test(url.trim())) throw new DomainError("Enter the full https:// link to the published content");
  const to = d.approvalState === "changes_requested" ? "resubmitted" : "submitted";
  assertTransition(deliverableMachine, "deliverable", d.approvalState, to);
  await db
    .update(deliverables)
    .set({ approvalState: to, submittedUrl: url.trim(), notes: notes.trim() || null, submittedAt: new Date() })
    .where(eq(deliverables.id, d.id));
  await audit(db, actor, "deliverable", d.id, to, { url });
  await notify(db, await brandUserIds(db, collab.campaign.organizationId), "Content submitted for review", `${collab.creator.displayName}: ${d.title}`, `/collaborations/${collab.root.id}`);
}

export async function reviewDeliverable(
  db: Executor,
  actor: Actor,
  deliverableId: string,
  decision: "approved" | "changes_requested" | "rejected",
  feedback: string,
) {
  requireBrand(actor);
  const { d, collab } = await deliverableForActor(db, actor, deliverableId);
  assertTransition(deliverableMachine, "deliverable", d.approvalState, decision);
  if (decision !== "approved" && feedback.trim().length < 5) throw new DomainError("Explain what needs to change");
  if (decision === "changes_requested" && d.revisionCount >= MAX_REVISIONS)
    throw new DomainError(`The agreement includes ${MAX_REVISIONS} revision rounds. Approve, reject, or propose an amendment.`);
  await db
    .update(deliverables)
    .set({
      approvalState: decision,
      feedback: feedback.trim() || null,
      revisionCount: decision === "changes_requested" ? d.revisionCount + 1 : d.revisionCount,
      approvedAt: decision === "approved" ? new Date() : null,
    })
    .where(eq(deliverables.id, d.id));
  await audit(db, actor, "deliverable", d.id, decision, { feedback });
  const label = decision === "approved" ? "Content approved" : decision === "rejected" ? "Content rejected" : "Changes requested";
  await notify(db, [await creatorUserId(db, collab.creator.id)], label, `${collab.campaign.title}: ${d.title}`, `/collaborations/${collab.root.id}`);
}

export async function listCreatorCollaborations(db: Executor, actor: Actor) {
  requireCreator(actor);
  const rows = await db
    .select({ agreement: agreements, campaign: campaigns, status: threadStatus })
    .from(agreements)
    .innerJoin(campaigns, eq(agreements.campaignId, campaigns.id))
    .where(and(eq(agreements.creatorProfileId, actor.creatorProfileId), eq(agreements.version, 1), inArray(agreements.status, ["offered", "accepted", "disputed", "completed", "superseded"])))
    .orderBy(desc(agreements.createdAt));
  return rows;
}

export async function listCampaignCollaborations(db: Executor, actor: Actor, campaignId: string) {
  const c = await getOwnedCampaign(db, actor, campaignId);
  return db
    .select({ agreement: agreements, creator: creatorProfiles, status: threadStatus })
    .from(agreements)
    .innerJoin(creatorProfiles, eq(agreements.creatorProfileId, creatorProfiles.id))
    .where(and(eq(agreements.campaignId, c.id), eq(agreements.version, 1)))
    .orderBy(asc(agreements.createdAt));
}
