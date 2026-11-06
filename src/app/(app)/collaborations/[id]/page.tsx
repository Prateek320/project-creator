import { BadgeCheck } from "lucide-react";
import { and, desc, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { acceptAgreementAction, amendAction, declineAgreementAction, reviewAction, reviewDeliverableAction, simulateAction, submitDeliverableAction } from "@/app/actions";
import { CopyButton, SubmitButton } from "@/components/client";
import { FormulaFields } from "@/components/formula";
import { Badge, Card, CardBody, CardHeader, Field, Flash, Notice, StatusChip, fmtDate, fmtDateTime, inputClass, relDays } from "@/components/ui";
import { describeFormula } from "@/domain/compensation";
import { formatINR } from "@/domain/money";
import { MAX_REVISIONS } from "@/domain/state";
import type { Formula } from "@/domain/types";
import { getReview } from "@/server/admin";
import { getCollaboration } from "@/server/collaborations";
import { requireActor } from "@/server/session";

function diffFormula(a: Formula, b: Formula): string[] {
  const out: string[] = [];
  if (a.model !== b.model) out.push(`Model: ${a.model} → ${b.model}`);
  const money = (k: keyof Formula, label: string) => {
    if (a[k] !== b[k]) out.push(`${label}: ${a[k] === undefined ? "—" : formatINR(a[k] as number)} → ${b[k] === undefined ? "—" : formatINR(b[k] as number)}`);
  };
  money("fixedFeeMinor", "Fixed fee");
  money("baseFeeMinor", "Base");
  money("ratePerOutcomeMinor", "Rate per outcome");
  money("capMinor", "Cap");
  money("floorMinor", "Floor");
  if (a.attributionWindowDays !== b.attributionWindowDays) out.push(`Attribution window: ${a.attributionWindowDays} → ${b.attributionWindowDays} days`);
  if (a.exclusions !== b.exclusions) out.push("Exclusions changed");
  return out;
}

/** Plain-language receipts for system events, so both sides see the record working for them. */
const EVIDENCE: Record<string, string> = {
  active: "Both sides accepted the same terms",
  amendment_proposed: "Takes effect only when both sides accept",
  approved: "Counts toward the agreed deliverables",
  settlement_approved: "Recorded in the double-entry ledger",
  payout_paid: "Ledger balanced · paid via the provider",
  completed: "Added to the creator's verified track record",
  reviewed: "Published to the creator's profile",
};

export default async function Workspace({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const actor = await requireActor();
  const { id } = await params;
  const sp = await searchParams;
  const db = await getDb();
  const c = await getCollaboration(db, actor, id);
  const back = `/collaborations/${c.root.id}`;
  const terms = c.active ?? c.pending ?? c.root;
  const trackedPath = `/r/${terms.trackingSlug}`;
  const entityIds = [...c.versions.map((v) => v.id), ...c.deliverables.map((d) => d.id)];
  const timeline = await db
    .select()
    .from(schema.auditEvents)
    .where(and(inArray(schema.auditEvents.entityId, entityIds)))
    .orderBy(desc(schema.auditEvents.createdAt))
    .limit(40);
  const review = c.side === "brand" && c.active?.status === "completed" ? await getReview(db, c.root.id) : null;
  const pending = c.pending;
  const iMustAccept = pending && ((c.side === "creator" && !pending.acceptedByCreatorAt) || (c.side === "brand" && !pending.acceptedByBrandAt));
  const isLive = c.active && (c.active.status === "accepted" || c.active.status === "disputed");

  return (
    <>
      <Flash sp={sp} />

      {pending && (
        <Card className={`mb-6 ${iMustAccept ? "border-amber-300" : ""}`}>
          <CardHeader
            title={pending.version === 1 ? "Offer" : `Proposed amendment · v${pending.version}`}
            description={pending.changeSummary ?? undefined}
            actions={<Badge tone="warn">{iMustAccept ? "Needs your response" : `Waiting for ${c.side === "creator" ? "the brand" : "the creator"}`}</Badge>}
          />
          <CardBody className="space-y-4">
            {pending.version === 1 ? (
              <>
                <p className="text-[15px] font-medium">{describeFormula(pending.formulaSnapshot)}</p>
                <ul className="grid gap-1 text-sm text-ink-2 sm:grid-cols-2">
                  {pending.deliverablesSnapshot.map((d, i) => <li key={i}>• {d.title} on {d.channel} — due {fmtDate(new Date(d.dueAt))}</li>)}
                </ul>
                <p className="text-sm text-muted">Usage rights: {pending.rights}</p>
                <p className="text-sm text-muted">Tracked link and code <span className="font-mono">{pending.couponCode}</span> are issued on acceptance. Up to {MAX_REVISIONS} revision rounds per deliverable.</p>
              </>
            ) : (
              <>
                <div className="text-sm">
                  <div className="mb-1 font-medium">What changes</div>
                  <ul className="space-y-1 text-ink-2">
                    {[...diffFormula(c.active!.formulaSnapshot, pending.formulaSnapshot), ...pending.deliverablesSnapshot
                      .map((d, i) => ({ d, i, old: c.active!.deliverablesSnapshot[i] }))
                      .filter(({ d, i, old }) => old && old.dueAt.slice(0, 10) !== d.dueAt.slice(0, 10) && c.deliverables[i]?.approvalState !== "approved")
                      .slice(0, 1)
                      .map(({ d }) => `Due dates of unapproved deliverables move (e.g. ${d.title} → ${fmtDate(new Date(d.dueAt))})`)].map((x) => <li key={x}>• {x}</li>)}
                  </ul>
                </div>
                <Notice tone="info">Current terms (v{c.active!.version}) stay in force until both sides accept. Past versions are never edited.</Notice>
              </>
            )}
            {iMustAccept ? (
              <div className="flex flex-wrap items-start gap-3">
                <form action={acceptAgreementAction}>
                  <input type="hidden" name="agreementId" value={pending.id} />
                  <input type="hidden" name="back" value={back} />
                  <SubmitButton variant="success" pendingLabel="Accepting…">{pending.version === 1 ? "Accept agreement" : "Accept amendment"}</SubmitButton>
                </form>
                <details>
                  <summary className="inline-flex h-11 items-center rounded-full bg-white px-5 text-sm font-semibold shadow-sm">Decline…</summary>
                  <form action={declineAgreementAction} className="mt-2 flex gap-2">
                    <input type="hidden" name="agreementId" value={pending.id} />
                    <input type="hidden" name="back" value={back} />
                    <input name="reason" placeholder="Reason (shared with the other party)" className={inputClass} />
                    <SubmitButton variant="danger">Decline</SubmitButton>
                  </form>
                </details>
              </div>
            ) : (
              <form action={declineAgreementAction}>
                <input type="hidden" name="agreementId" value={pending.id} />
                <input type="hidden" name="reason" value="Withdrawn by proposer" />
                <input type="hidden" name="back" value={back} />
                <SubmitButton variant="ghost" size="sm">Withdraw {pending.version === 1 ? "offer" : "amendment"}</SubmitButton>
              </form>
            )}
          </CardBody>
        </Card>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_340px] lg:items-start">
        <div className="min-w-0 space-y-8">
          <Card id="deliverables">
            <CardHeader title="Deliverables" description={c.deliverables.length ? `${c.deliverables.filter((d) => d.approvalState === "approved").length} of ${c.deliverables.length} approved` : undefined} />
            {c.deliverables.length === 0 ? (
              <p className="px-6 py-8 text-sm text-muted">Deliverables appear once the agreement is accepted by both sides.</p>
            ) : (
              <ol className="divide-y divide-line-2">
                {c.deliverables.map((d) => {
                  const overdue = d.dueAt < new Date() && !["approved", "submitted", "resubmitted"].includes(d.approvalState);
                  const creatorCanSubmit = c.side === "creator" && isLive && (d.approvalState === "pending" || d.approvalState === "changes_requested");
                  const brandCanReview = c.side === "brand" && (d.approvalState === "submitted" || d.approvalState === "resubmitted");
                  return (
                    <li key={d.id} className="px-6 py-5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="font-medium">{d.title} <span className="font-normal text-muted">· {d.channel}</span></div>
                          <div className={`text-xs ${overdue ? "text-bad" : "text-muted"}`}>Due {fmtDate(d.dueAt)} ({relDays(d.dueAt)}){d.revisionCount ? ` · revision ${d.revisionCount}/${MAX_REVISIONS}` : ""}</div>
                        </div>
                        <StatusChip status={d.approvalState} />
                      </div>
                      {d.submittedUrl && <a href={d.submittedUrl} target="_blank" rel="noopener noreferrer nofollow" className="mt-2 inline-block break-all text-sm text-accent hover:underline">{d.submittedUrl} ↗</a>}
                      {d.notes && <p className="mt-1 text-sm text-muted">Creator note: {d.notes}</p>}
                      {d.feedback && <p className="mt-1 rounded-lg bg-warn-50 px-3 py-2 text-sm text-amber-900">Brand feedback: {d.feedback}</p>}
                      {creatorCanSubmit && (
                        <form action={submitDeliverableAction} className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                          <input type="hidden" name="deliverableId" value={d.id} />
                          <input type="hidden" name="back" value={back} />
                          <input name="url" required type="url" placeholder="https:// link to the live post" aria-label="Content link" className={inputClass} />
                          <input name="notes" placeholder="Note for the brand (optional)" aria-label="Note" className={inputClass} />
                          <SubmitButton size="md">{d.approvalState === "changes_requested" ? "Resubmit" : "Submit"}</SubmitButton>
                        </form>
                      )}
                      {brandCanReview && (
                        <form action={reviewDeliverableAction} className="mt-3 space-y-2">
                          <input type="hidden" name="deliverableId" value={d.id} />
                          <input type="hidden" name="back" value={back} />
                          <input name="feedback" placeholder="Feedback (required for changes or rejection)" aria-label="Feedback" className={inputClass} />
                          <div className="flex flex-wrap gap-2">
                            <SubmitButton name="decision" value="approved" variant="success" size="sm">Approve</SubmitButton>
                            <SubmitButton name="decision" value="changes_requested" variant="secondary" size="sm" disabled={d.revisionCount >= MAX_REVISIONS}>Request changes</SubmitButton>
                            <SubmitButton name="decision" value="rejected" variant="danger" size="sm" confirm="Reject this deliverable? Use only if it can't meet the agreed criteria.">Reject</SubmitButton>
                          </div>
                        </form>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>

        </div>

        <div className="space-y-8 lg:row-span-2">
          <Card>
            <CardHeader title={`Agreement · v${terms.version}`} actions={<StatusChip status={terms.status} />} />
            <CardBody className="space-y-3 text-sm">
              <p className="font-medium">{describeFormula(terms.formulaSnapshot)}</p>
              {terms.formulaSnapshot.exclusions && <p className="text-muted">Excludes: {terms.formulaSnapshot.exclusions}</p>}
              <p className="text-muted">Rights: {terms.rights}</p>
              <dl className="space-y-1 border-t border-line-2 pt-3 text-xs">
                <div className="flex justify-between"><dt className="text-muted">Brand accepted</dt><dd>{terms.acceptedByBrandAt ? fmtDateTime(terms.acceptedByBrandAt) : "—"}</dd></div>
                <div className="flex justify-between"><dt className="text-muted">Creator accepted</dt><dd>{terms.acceptedByCreatorAt ? fmtDateTime(terms.acceptedByCreatorAt) : "—"}</dd></div>
              </dl>
              {c.versions.length > 1 && (
                <details>
                  <summary className="text-xs font-medium text-accent">Version history ({c.versions.length})</summary>
                  <ul className="mt-2 space-y-2">
                    {c.versions.map((v) => (
                      <li key={v.id} className="rounded-lg bg-sunken px-3 py-2 text-xs">
                        <div className="flex justify-between"><span className="font-medium">v{v.version}</span><StatusChip status={v.status} /></div>
                        <div className="mt-0.5 text-muted">{v.changeSummary}</div>
                        <div className="mt-0.5">{describeFormula(v.formulaSnapshot)}</div>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </CardBody>
          </Card>

          {c.active && (
            <Card>
              <CardHeader title="Tracking" description="Share these — outcomes are attributed to you through them." />
              <CardBody className="space-y-3 text-sm">
                <div>
                  <div className="text-xs text-muted">Tracked link</div>
                  <div className="mt-1 flex items-center gap-2"><code className="min-w-0 flex-1 truncate rounded bg-black/5 px-2 py-1 text-xs">{trackedPath}</code><CopyButton value={trackedPath} absolute /></div>
                </div>
                <div>
                  <div className="text-xs text-muted">Coupon code</div>
                  <div className="mt-1 flex items-center gap-2"><code className="rounded bg-black/5 px-2 py-1 font-semibold">{terms.couponCode}</code><CopyButton value={terms.couponCode} /></div>
                </div>
                {c.side === "brand" && isLive && (
                  <form action={simulateAction} className="space-y-2 border-t border-line-2 pt-3">
                    <input type="hidden" name="agreementId" value={c.root.id} />
                    <input type="hidden" name="back" value={back} />
                    <div className="text-xs font-medium text-ink-2">Demo: simulate your backend webhook</div>
                    <div className="flex gap-2">
                      <input name="count" defaultValue="10" inputMode="numeric" aria-label="Number of conversions" className={`${inputClass} w-20`} />
                      <SubmitButton variant="secondary" size="md">Send {terms.formulaSnapshot.outcomeEvent ?? "signup"}s</SubmitButton>
                    </div>
                    <p className="text-xs text-muted">Goes through the same ingest path as a signed webhook, including one replayed event to show deduplication.</p>
                  </form>
                )}
              </CardBody>
            </Card>
          )}

          {isLive && !pending && c.side !== "admin" && (
            <Card>
              <details>
                <summary className="px-6 py-5 text-sm font-semibold">Propose a change to the terms</summary>
                <form action={amendAction} className="space-y-4 px-6 pb-6">
                  <input type="hidden" name="agreementId" value={c.root.id} />
                  <input type="hidden" name="back" value={back} />
                  <Field label="What's changing and why" htmlFor="summary"><input id="summary" name="summary" required className={inputClass} placeholder="e.g. Extend deadlines by 3 days after shipping delay" /></Field>
                  <Field label="Shift unapproved due dates by (days)" htmlFor="shiftDueDays"><input id="shiftDueDays" name="shiftDueDays" defaultValue="0" inputMode="numeric" className={inputClass} /></Field>
                  <FormulaFields initial={c.active!.formulaSnapshot} compact />
                  <SubmitButton>Propose amendment</SubmitButton>
                </form>
              </details>
            </Card>
          )}

          {c.side === "brand" && c.active?.status === "completed" && !review && (
            <Card>
              <CardHeader title="Rate this collaboration" description="Structured and moderated. Reviews build the creator's verified reputation." />
              <CardBody>
                <form action={reviewAction} className="space-y-3 text-sm">
                  <input type="hidden" name="agreementId" value={c.root.id} />
                  <input type="hidden" name="back" value={back} />
                  {(["rating", "quality", "communication", "timeliness"] as const).map((k) => (
                    <label key={k} className="flex items-center justify-between gap-3">
                      <span className="capitalize">{k === "rating" ? "Overall" : k}</span>
                      <select name={k} defaultValue="5" className={`${inputClass} w-24`}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} / 5</option>)}</select>
                    </label>
                  ))}
                  <textarea name="comment" rows={2} placeholder="What went well? (optional)" className={inputClass} />
                  <SubmitButton size="sm">Publish review</SubmitButton>
                </form>
              </CardBody>
            </Card>
          )}
          {review && <Notice tone="good">You rated this collaboration {review.rating}/5.</Notice>}
        </div>
        <div className="min-w-0 lg:col-start-1">
            <Card>
              <CardHeader title="Activity" description="Immutable audit trail for this collaboration" />
              <ol className="relative space-y-0 px-6 py-5">
                {timeline.map((e, i) => (
                  <li key={e.id} className="relative animate-pop-in border-l border-line pb-4 pl-5 last:pb-0" style={{ animationDelay: `${Math.min(i, 10) * 45}ms` }}>
                    <span aria-hidden className={`absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white ${i === 0 ? "bg-ink" : "bg-black/25"}`} />
                    <div className="text-sm"><span className="capitalize">{e.action.replace(/_/g, " ")}</span> <span className="text-muted">· {c.deliverables.find((d) => d.id === e.entityId)?.title ?? (e.entityType === "agreement" ? `agreement v${c.versions.find((v) => v.id === e.entityId)?.version ?? ""}` : e.entityType)}</span></div>
                    <div className="text-xs text-muted">{fmtDateTime(e.createdAt)}{e.reason ? ` · “${e.reason}”` : ""}</div>
                    {EVIDENCE[e.action] && (
                      <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-black/5 px-2.5 py-0.5 text-[11px] font-semibold text-ink-2">
                        <BadgeCheck size={12} aria-hidden /> {EVIDENCE[e.action]}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            </Card>
        </div>
      </div>
    </>
  );
}
