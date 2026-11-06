"use server";

/**
 * Server actions. Thin: parse input → call a domain service (which authorises the actor) →
 * redirect back with a notice or a human-readable error. Never trust anything from the client.
 */
import { notFound, redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { getDb, schema, type DB } from "@/db";
import { seed } from "@/db/seed";
import { parseCsv } from "@/domain/attribution";
import { DomainError } from "@/domain/types";
import * as admin from "@/server/admin";
import * as campaigns from "@/server/campaigns";
import * as collab from "@/server/collaborations";
import type { Actor } from "@/server/core";
import * as creators from "@/server/creators";
import * as finance from "@/server/finance";
import { csvList, date, formulaFrom, int, list, money, safeBack, str } from "@/server/forms";
import { assertDemo, isDemo } from "@/server/env";
import { clearSession, homeFor, requireActor, setSession } from "@/server/session";

function withParam(path: string, key: string, value: string) {
  const [base, hash] = path.split("#");
  const url = new URL(base!, "http://x");
  url.searchParams.delete("notice");
  url.searchParams.delete("error");
  url.searchParams.set(key, value);
  return `${url.pathname}${url.search}${hash ? `#${hash}` : ""}`;
}

async function act(fd: FormData, fallback: string, fn: (db: DB, actor: Actor) => Promise<string | { notice: string; to: string }>) {
  const db = await getDb();
  const actor = await requireActor();
  const back = safeBack(fd, fallback);
  let target: string;
  try {
    const res = await fn(db, actor);
    target = typeof res === "string" ? withParam(back, "notice", res) : withParam(res.to, "notice", res.notice);
  } catch (err) {
    if (err instanceof DomainError) target = withParam(back, "error", err.message);
    else {
      console.error(err);
      target = withParam(back, "error", "Something went wrong. Nothing was changed — please try again.");
    }
  }
  // Every page is dynamic and the client router doesn't cache dynamic pages (Next 15 default),
  // so the redirect alone renders fresh data. Avoid revalidatePath here: combined with redirect it
  // races the client router and can drop the navigation.
  redirect(target);
}

// ---------- session ----------
/** Demo sign-in: pick a seeded account. Replaced by managed auth outside the demo (slice 2). */
export async function loginAs(fd: FormData) {
  if (!isDemo()) notFound();
  const db = await getDb();
  const email = str(fd, "email");
  const [u] = await db.select().from(schema.users).where(eq(schema.users.email, email));
  if (!u) redirect("/login?error=Unknown%20demo%20account");
  await setSession(u.id);
  redirect(homeFor(u));
}
export async function logout() {
  await clearSession();
  redirect("/");
}
export async function resetDemo(fd: FormData) {
  await act(fd, "/", async (db) => {
    assertDemo();
    const tables = Object.values(schema)
      .filter((t) => typeof t === "object" && t !== null && Symbol.for("drizzle:Name") in t)
      .map((t) => (t as unknown as Record<symbol, string>)[Symbol.for("drizzle:Name")]);
    await db.execute(sql.raw(`TRUNCATE ${tables.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`));
    await seed(db);
    await clearSession();
    return { notice: "Demo data reset — sign in again", to: "/login" };
  });
}

// ---------- campaigns ----------
export async function createCampaignAction(fd: FormData) {
  await act(fd, "/brand/campaigns/new", async (db, actor) => {
    const types = list(fd, "req_type");
    const channels = list(fd, "req_channel");
    const qty = list(fd, "req_qty");
    const due = list(fd, "req_due");
    const crit = fd.getAll("req_criteria").map(String);
    const requirements = types.map((t, i) => ({
      deliverableType: t.slice(0, 60),
      channel: channels[i] ?? "Instagram",
      quantity: Number(qty[i] ?? 1) | 0,
      dueOffsetDays: Number(due[i] ?? 7) | 0,
      acceptanceCriteria: (crit[i] ?? "").slice(0, 500),
    }));
    const publish = str(fd, "intent") === "publish";
    const c = await campaigns.createCampaign(
      db,
      actor,
      {
        title: str(fd, "title", 120),
        brief: str(fd, "brief", 3000),
        objective: str(fd, "objective"),
        niche: str(fd, "niche"),
        channels: list(fd, "channels"),
        audience: { locations: csvList(fd, "locations"), ageRange: str(fd, "ageRange", 20), languages: list(fd, "languages"), minFollowers: int(fd, "minFollowers") },
        budgetMinor: money(fd, "budget"),
        creatorSlots: int(fd, "creatorSlots", 1),
        compensation: formulaFrom(fd),
        measurement: {
          primaryMetric: str(fd, "primaryMetric", 80),
          target: int(fd, "target", 0),
          sourceOfTruth: (["brand_webhook", "csv_upload", "tracked_link"].includes(str(fd, "sourceOfTruth")) ? str(fd, "sourceOfTruth") : "brand_webhook") as "brand_webhook",
          validDefinition: str(fd, "validDefinition", 500),
        },
        rights: str(fd, "rights", 1000),
        landingUrl: str(fd, "landingUrl", 300),
        startAt: date(fd, "startAt"),
        endAt: date(fd, "endAt"),
        applyBy: str(fd, "applyBy") ? date(fd, "applyBy") : null,
        visibility: str(fd, "visibility") === "private" ? "private" : "public",
        requirements,
      },
      publish,
    );
    return { notice: publish ? "Campaign published" : "Draft saved", to: `/brand/campaigns/${c.id}` };
  });
}
export async function campaignTransitionAction(fd: FormData) {
  await act(fd, "/brand/campaigns", async (db, actor) => {
    const to = str(fd, "to") as "paused" | "published" | "completed" | "cancelled";
    await campaigns.transitionCampaign(db, actor, str(fd, "campaignId"), to);
    return { published: "Campaign published", paused: "Campaign paused", completed: "Campaign closed", cancelled: "Campaign cancelled" }[to] ?? "Updated";
  });
}
export async function fundCampaignAction(fd: FormData) {
  await act(fd, "/brand/campaigns", async (db, actor) => {
    await campaigns.fundCampaign(db, actor, str(fd, "campaignId"));
    return "Campaign funded (test mode — no real money moved)";
  });
}
export async function refundAction(fd: FormData) {
  await act(fd, "/brand/billing", async (db, actor) => {
    await finance.refundUnspent(db, actor, str(fd, "campaignId"));
    return "Unspent funds refunded (test mode)";
  });
}

// ---------- applications ----------
export async function applyAction(fd: FormData) {
  await act(fd, "/creator/campaigns", async (db, actor) => {
    await collab.applyToCampaign(db, actor, str(fd, "campaignId"), {
      pitch: str(fd, "pitch", 2000),
      proposedRateMinor: money(fd, "rate"),
      availability: str(fd, "availability", 200),
      portfolioLinks: csvList(fd, "links"),
    });
    return { notice: "Application sent. You'll be notified when the brand responds.", to: "/creator/applications" };
  });
}
export async function withdrawAction(fd: FormData) {
  await act(fd, "/creator/applications", async (db, actor) => {
    await collab.withdrawApplication(db, actor, str(fd, "applicationId"));
    return "Application withdrawn";
  });
}
export async function applicationStatusAction(fd: FormData) {
  await act(fd, "/brand/campaigns", async (db, actor) => {
    const to = str(fd, "to") === "rejected" ? "rejected" : "shortlisted";
    await collab.setApplicationStatus(db, actor, str(fd, "applicationId"), to, str(fd, "note", 300));
    return to === "rejected" ? "Application declined — the creator has been notified" : "Added to shortlist";
  });
}
export async function offerAction(fd: FormData) {
  await act(fd, "/brand/campaigns", async (db, actor) => {
    const ag = await collab.makeOffer(db, actor, str(fd, "applicationId"), { formula: formulaFrom(fd), note: str(fd, "note", 300) });
    return { notice: "Offer sent. It becomes binding once the creator accepts.", to: `/collaborations/${ag.id}` };
  });
}

// ---------- agreements ----------
export async function acceptAgreementAction(fd: FormData) {
  await act(fd, "/", async (db, actor) => {
    await collab.acceptAgreement(db, actor, str(fd, "agreementId"));
    return "Accepted";
  });
}
export async function declineAgreementAction(fd: FormData) {
  await act(fd, "/", async (db, actor) => {
    await collab.declineAgreement(db, actor, str(fd, "agreementId"), str(fd, "reason", 300));
    return "Declined";
  });
}
export async function amendAction(fd: FormData) {
  await act(fd, "/", async (db, actor) => {
    await collab.proposeAmendment(db, actor, str(fd, "agreementId"), { formula: formulaFrom(fd), shiftDueDays: int(fd, "shiftDueDays"), summary: str(fd, "summary", 300) });
    return "Amendment proposed. The current terms stay in force until the other party accepts.";
  });
}

// ---------- deliverables ----------
export async function submitDeliverableAction(fd: FormData) {
  await act(fd, "/", async (db, actor) => {
    await collab.submitDeliverable(db, actor, str(fd, "deliverableId"), str(fd, "url", 500), str(fd, "notes", 500));
    return "Submitted for review";
  });
}
export async function reviewDeliverableAction(fd: FormData) {
  await act(fd, "/", async (db, actor) => {
    const d = str(fd, "decision");
    const decision = d === "approved" || d === "rejected" ? d : "changes_requested";
    await collab.reviewDeliverable(db, actor, str(fd, "deliverableId"), decision, str(fd, "feedback", 1000));
    return decision === "approved" ? "Approved" : decision === "rejected" ? "Rejected" : "Changes requested";
  });
}

// ---------- attribution ----------
export async function simulateAction(fd: FormData) {
  await act(fd, "/", async (db, actor) => {
    const id = str(fd, "agreementId");
    const r = await finance.simulateConversions(db, actor, id, int(fd, "count", 10));
    // Land on the settlement so the brand watches the new events tick in.
    return { notice: `Demo webhook: ${r.accepted} new events recorded, ${r.duplicates} duplicate ignored`, to: `/collaborations/${id}/settlement` };
  });
}
export async function csvImportAction(fd: FormData) {
  await act(fd, "/brand/campaigns", async (db, actor) => {
    if (actor.role !== "brand" || !actor.orgId) throw new DomainError("Only brands can import conversions");
    const file = fd.get("file");
    let text = str(fd, "csv", 500_000);
    if (file instanceof File && file.size > 0) {
      if (file.size > 1_000_000) throw new DomainError("CSV must be under 1 MB");
      if (!/\.csv$/i.test(file.name) && file.type !== "text/csv") throw new DomainError("Upload a .csv file");
      text = await file.text();
    }
    const rows = parseCsv(text);
    if (rows.length === 0) throw new DomainError("No rows found. The first line must be a header.");
    const r = await finance.ingestEvents(db, actor.orgId, rows.map((row) => ({ ...row, campaign_id: row.campaign_id || str(fd, "campaignId") })), "csv_upload");
    const rejected = r.rejected.slice(0, 3).map((x) => `row ${x.index + 2}: ${x.reason}`).join("; ");
    return `Imported ${r.accepted} events · ${r.duplicates} duplicates skipped · ${r.rejected.length} rejected${rejected ? ` (${rejected})` : ""}`;
  });
}
export async function eventValidityAction(fd: FormData) {
  await act(fd, "/", async (db, actor) => {
    const to = str(fd, "to") === "valid" ? "valid" : "invalid";
    await finance.setEventValidity(db, actor, str(fd, "eventId"), to, str(fd, "reason", 300));
    return to === "invalid" ? "Event excluded and logged to the audit trail" : "Event restored";
  });
}

// ---------- settlement ----------
export async function approveSettlementAction(fd: FormData) {
  await act(fd, "/", async (db, actor) => {
    await finance.approveSettlement(db, actor, str(fd, "agreementId"));
    return "Settlement approved and recorded in the ledger";
  });
}
export async function payoutAction(fd: FormData) {
  await act(fd, "/", async (db, actor) => {
    await finance.payoutCreator(db, actor, str(fd, "agreementId"));
    return { notice: "Payout sent via the mock provider (test mode)", to: withParam(safeBack(fd, "/"), "receipt", "1") };
  });
}
export async function completeAction(fd: FormData) {
  await act(fd, "/", async (db, actor) => {
    await finance.completeCollaboration(db, actor, str(fd, "agreementId"));
    return "Collaboration completed — it now counts toward the creator's verified track record";
  });
}
export async function disputeAction(fd: FormData) {
  await act(fd, "/", async (db, actor) => {
    await finance.openDispute(db, actor, str(fd, "agreementId"), {
      category: str(fd, "category"),
      description: str(fd, "description", 2000),
      amountHeldMinor: str(fd, "amount") ? money(fd, "amount") : 0,
    });
    return "Dispute opened. Only the disputed amount is held; operations will review.";
  });
}
export async function resolveDisputeAction(fd: FormData) {
  await act(fd, "/admin", async (db, actor) => {
    const o = str(fd, "outcome");
    await finance.resolveDispute(db, actor, str(fd, "disputeId"), {
      outcome: o === "upheld" || o === "rejected" ? o : "split",
      creatorShareMinor: money(fd, "creatorShare"),
      reason: str(fd, "reason", 1000),
    });
    return { notice: "Dispute resolved and both parties notified", to: "/admin" };
  });
}
export async function reverseTransferAction(fd: FormData) {
  await act(fd, "/admin", async (db, actor) => {
    await finance.reverseTransfer(db, actor, str(fd, "transferId"), str(fd, "reason", 300));
    return "Transfer reversed with compensating ledger entries";
  });
}
export async function reviewAction(fd: FormData) {
  await act(fd, "/", async (db, actor) => {
    await admin.leaveReview(db, actor, str(fd, "agreementId"), {
      rating: int(fd, "rating"),
      quality: int(fd, "quality"),
      communication: int(fd, "communication"),
      timeliness: int(fd, "timeliness"),
      comment: str(fd, "comment", 1000),
    });
    return "Review published";
  });
}

// ---------- creator profile ----------
export async function updateProfileAction(fd: FormData) {
  await act(fd, "/creator/profile", async (db, actor) => {
    await creators.updateProfile(db, actor, {
      displayName: str(fd, "displayName", 80),
      headline: str(fd, "headline", 120),
      bio: str(fd, "bio", 1000),
      location: str(fd, "location", 80),
      languages: csvList(fd, "languages"),
      niches: list(fd, "niches"),
      audienceBand: str(fd, "audienceBand"),
      rateMinMinor: money(fd, "rateMin"),
      rateMaxMinor: money(fd, "rateMax"),
      availability: str(fd, "availability") === "busy" ? "busy" : "available",
      visibility: str(fd, "visibility") === "private" ? "private" : "public",
    });
    return "Profile saved";
  });
}
export async function addAccountAction(fd: FormData) {
  await act(fd, "/creator/profile", async (db, actor) => {
    await creators.addManualAccount(db, actor, {
      platform: str(fd, "platform"),
      handle: str(fd, "handle", 60),
      followers: int(fd, "followers"),
      engagementRate: Number(str(fd, "engagementRate") || "0"),
      evidenceUrl: str(fd, "evidenceUrl", 500),
    });
    return "Account added — metrics are labelled ‘Creator reported’ until verified";
  });
}
export async function disconnectAction(fd: FormData) {
  await act(fd, "/creator/profile", async (db, actor) => {
    await creators.disconnectAccount(db, actor, str(fd, "accountId"));
    return "Account disconnected and access revoked";
  });
}
export async function addPortfolioAction(fd: FormData) {
  await act(fd, "/creator/profile", async (db, actor) => {
    await creators.addPortfolioItem(db, actor, {
      title: str(fd, "title", 120),
      url: str(fd, "url", 500),
      platform: str(fd, "platform"),
      brandName: str(fd, "brandName", 80),
      resultSummary: str(fd, "resultSummary", 200),
    });
    return "Added to portfolio";
  });
}

// ---------- ops ----------
export async function verificationAction(fd: FormData) {
  await act(fd, "/admin", async (db, actor) => {
    const kind = str(fd, "kind") === "organization" ? "organization" : "creator";
    const to = str(fd, "to") === "rejected" ? "rejected" : "verified";
    await admin.setVerification(db, actor, kind, str(fd, "id"), to, str(fd, "reason", 300));
    return `Marked ${to}`;
  });
}
export async function markReadAction(fd: FormData) {
  await act(fd, "/notifications", async (db, actor) => {
    await admin.markNotificationsRead(db, actor);
    return "All caught up";
  });
}
