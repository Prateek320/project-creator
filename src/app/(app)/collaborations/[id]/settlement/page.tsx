import { getDb } from "@/db";
import { approveSettlementAction, completeAction, disputeAction, payoutAction } from "@/app/actions";
import { SubmitButton } from "@/components/client";
import { Card, CardBody, CardHeader, Field, Flash, Money, Notice, Stat, StatusChip, fmtDateTime, inputClass } from "@/components/ui";
import { describeFormula } from "@/domain/compensation";
import { ACCOUNTS } from "@/domain/ledger";
import { formatINR } from "@/domain/money";
import { DISPUTE_CATEGORIES, getSettlement } from "@/server/finance";
import { requireActor } from "@/server/session";

export const metadata = { title: "Earnings & settlement" };

export default async function Settlement({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const actor = await requireActor();
  const { id } = await params;
  const sp = await searchParams;
  const s = await getSettlement(await getDb(), actor, id);
  const { collab: c, result: r, formula: f } = s;
  const back = `/collaborations/${c.root.id}/settlement`;
  const outcomeEvents = s.events.filter((e) => e.eventType !== "click");
  const clicks = s.events.filter((e) => e.eventType === "click" && e.validityState === "valid").length;
  const isBrand = c.side === "brand";
  const live = c.active && (c.active.status === "accepted" || c.active.status === "disputed");

  return (
    <>
      <Flash sp={sp} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Earned under the agreement" value={formatINR(r.totalMinor)} hint={`Agreement v${c.active?.version ?? c.root.version}`} />
        <Stat label="Approved by brand" value={formatINR(s.settledToDate)} hint={s.pendingApprovalMinor > 0 ? `${formatINR(s.pendingApprovalMinor)} awaiting approval` : "Up to date"} tone={s.pendingApprovalMinor > 0 ? "warn" : "good"} />
        <Stat label="Paid out" value={formatINR(s.balances.creator_paid)} hint={`${formatINR(s.balances.creator_payable)} ready for payout`} />
        <Stat label="Held for dispute" value={formatINR(s.balances.dispute_hold)} hint={s.openDispute ? "Undisputed portion still payable" : "Nothing held"} tone={s.balances.dispute_hold ? "warn" : undefined} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="How this was calculated" description={describeFormula(f)} />
            <CardBody>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-line-2">
                  {r.lines.map((l) => (
                    <tr key={l.label}>
                      <td className="py-2.5 pr-3"><div className="font-medium">{l.label}</div><div className="text-xs text-muted">{l.detail}</div></td>
                      <td className={`tnum py-2.5 text-right ${l.amountMinor < 0 ? "text-bad" : ""}`}>{l.amountMinor === 0 && l.label === "Excluded events" ? "—" : `${l.amountMinor < 0 ? "−" : ""}${formatINR(Math.abs(l.amountMinor))}`}</td>
                    </tr>
                  ))}
                  <tr><td className="pt-3 font-semibold">Total earned</td><td className="tnum pt-3 text-right text-lg font-semibold"><Money minor={r.totalMinor} /></td></tr>
                </tbody>
              </table>
              {f.model === "hybrid" && r.deliverablesApproved < r.deliverablesTotal && (
                <p className="mt-3 text-xs text-muted">The {formatINR(f.baseFeeMinor ?? 0)} base is added once all {r.deliverablesTotal} deliverables are approved.</p>
              )}
              <p className="mt-3 text-xs text-muted">Deterministic: the same events and agreement version always give the same result. Window: campaign dates + {f.attributionWindowDays} days.</p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Evidence" description={`${outcomeEvents.length} outcome events received · ${clicks.toLocaleString("en-IN")} tracked clicks`} />
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="sticky top-0 bg-white"><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted"><th className="px-5 py-2 font-medium">Event ID</th><th className="px-3 py-2 font-medium">Type</th><th className="px-3 py-2 font-medium">Time</th><th className="px-3 py-2 font-medium">Source</th><th className="px-5 py-2 font-medium">Counted?</th></tr></thead>
                <tbody className="divide-y divide-line-2">
                  {outcomeEvents.slice(0, 200).map((e) => (
                    <tr key={e.id}>
                      <td className="px-5 py-2 font-mono text-xs">{e.eventId}</td>
                      <td className="px-3 py-2">{e.eventType}</td>
                      <td className="px-3 py-2 text-xs text-muted">{fmtDateTime(e.occurredAt)}</td>
                      <td className="px-3 py-2 text-xs text-muted">{e.source.replace(/_/g, " ")}</td>
                      <td className="px-5 py-2"><StatusChip status={e.validityState} />{e.reasonCode && <span className="ml-2 text-xs text-muted">{e.reasonCode.replace(/_/g, " ")}</span>}</td>
                    </tr>
                  ))}
                  {outcomeEvents.length === 0 && <tr><td colSpan={5} className="px-5 py-6 text-center text-muted">No outcome events yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardHeader title="Ledger" description="Append-only. Every transaction balances to zero." />
            {s.entries.length === 0 ? <p className="px-5 py-6 text-sm text-muted">No entries yet.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted"><th className="px-5 py-2 font-medium">When</th><th className="px-3 py-2 font-medium">Account</th><th className="px-3 py-2 font-medium">Memo</th><th className="px-5 py-2 text-right font-medium">Amount</th></tr></thead>
                  <tbody className="divide-y divide-line-2">
                    {[...s.entries].reverse().map((e) => (
                      <tr key={e.id}>
                        <td className="whitespace-nowrap px-5 py-2 text-xs text-muted">{fmtDateTime(e.createdAt)}</td>
                        <td className="px-3 py-2">{ACCOUNTS[e.account as keyof typeof ACCOUNTS] ?? e.account}</td>
                        <td className="max-w-[280px] px-3 py-2 text-xs text-muted">{e.memo}</td>
                        <td className={`tnum px-5 py-2 text-right ${e.amountMinor < 0 ? "text-bad" : "text-good"}`}>{e.amountMinor > 0 ? "+" : "−"}{formatINR(Math.abs(e.amountMinor))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          {isBrand && (
            <Card>
              <CardHeader title="Actions" />
              <CardBody className="space-y-3">
                {c.campaign.fundingState !== "funded" && <Notice tone="warn">Fund the campaign before approving settlements.</Notice>}
                {s.pendingApprovalMinor > 0 && (
                  <form action={approveSettlementAction}>
                    <input type="hidden" name="agreementId" value={c.root.id} />
                    <input type="hidden" name="back" value={back} />
                    <SubmitButton className="w-full" disabled={c.campaign.fundingState !== "funded"} pendingLabel="Approving…">Approve {formatINR(s.pendingApprovalMinor)}</SubmitButton>
                    <p className="mt-1.5 text-xs text-muted">Approves the amount earned since the last approval.{s.openDispute ? ` Up to ${formatINR(Math.max(0, s.openDispute.amountHeldMinor - s.balances.dispute_hold))} will be held for the open dispute.` : ""}</p>
                  </form>
                )}
                {s.pendingApprovalMinor < 0 && <Notice tone="warn">Earned is now {formatINR(-s.pendingApprovalMinor)} below what was approved (events were excluded). Open a dispute so operations can review an adjustment.</Notice>}
                {s.balances.creator_payable > 0 && (
                  <form action={payoutAction}>
                    <input type="hidden" name="agreementId" value={c.root.id} />
                    <input type="hidden" name="back" value={back} />
                    <SubmitButton variant="success" className="w-full" pendingLabel="Paying…">Pay out {formatINR(s.balances.creator_payable)}</SubmitButton>
                    <p className="mt-1.5 text-xs text-muted">Mock payment provider · idempotent · no real money moves.</p>
                  </form>
                )}
                {c.active?.status === "accepted" && s.pendingApprovalMinor === 0 && s.balances.creator_payable === 0 && (
                  <form action={completeAction}>
                    <input type="hidden" name="agreementId" value={c.root.id} />
                    <input type="hidden" name="back" value={back} />
                    <SubmitButton variant="secondary" className="w-full" confirm="Mark this collaboration complete? It will count toward the creator's verified track record.">Mark collaboration complete</SubmitButton>
                  </form>
                )}
                {s.pendingApprovalMinor === 0 && s.balances.creator_payable === 0 && c.active?.status !== "accepted" && <p className="text-sm text-muted">Nothing to action right now.</p>}
              </CardBody>
            </Card>
          )}

          {s.transfers.length > 0 && (
            <Card>
              <CardHeader title="Payouts" />
              <ul className="divide-y divide-line-2">
                {s.transfers.map((t) => (
                  <li key={t.id} className="flex items-center justify-between px-5 py-3 text-sm">
                    <div><Money minor={t.amountMinor} className="font-medium" /><div className="font-mono text-[11px] text-muted">{t.providerRef}</div></div>
                    <StatusChip status={t.state} />
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <CardHeader title="Disputes" description="Hold only what's disputed. Operations reviews with full evidence." />
            <CardBody className="space-y-3 text-sm">
              {s.disputes.map((d) => (
                <div key={d.id} className="rounded-lg border border-line p-3">
                  <div className="flex items-center justify-between"><span className="font-medium capitalize">{d.category.replace(/_/g, " ")}</span><StatusChip status={d.state} /></div>
                  <p className="mt-1 text-muted">{d.description}</p>
                  <div className="mt-1 text-xs text-muted">Hold requested: {formatINR(d.amountHeldMinor)} · opened {fmtDateTime(d.createdAt)}</div>
                  {d.resolution && <p className="mt-2 rounded bg-slate-50 px-2 py-1 text-xs">Resolution ({d.resolution.outcome}) by {d.resolution.by}: {d.resolution.reason}</p>}
                </div>
              ))}
              {s.disputes.length === 0 && <p className="text-muted">No disputes.</p>}
              {live && !s.openDispute && c.side !== "admin" && (
                <details>
                  <summary className="font-medium text-accent">Open a dispute…</summary>
                  <form action={disputeAction} className="mt-3 space-y-3">
                    <input type="hidden" name="agreementId" value={c.root.id} />
                    <input type="hidden" name="back" value={back} />
                    <Field label="Category" htmlFor="category"><select id="category" name="category" className={inputClass}>{DISPUTE_CATEGORIES.map((k) => <option key={k} value={k}>{k.replace(/_/g, " ")}</option>)}</select></Field>
                    <Field label="What happened" htmlFor="description" hint="Include links to evidence."><textarea id="description" name="description" rows={3} className={inputClass} /></Field>
                    <Field label="Amount to hold (₹)" htmlFor="amount" hint="Only this amount is held; the rest proceeds."><input id="amount" name="amount" inputMode="decimal" defaultValue="0" className={inputClass} /></Field>
                    <SubmitButton variant="danger" size="sm">Open dispute</SubmitButton>
                  </form>
                </details>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
