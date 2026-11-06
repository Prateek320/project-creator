import { getDb } from "@/db";
import { approveSettlementAction, completeAction, disputeAction, payoutAction } from "@/app/actions";
import { SubmitButton } from "@/components/client";
import { AutoRefresh, CountUp, NewRows } from "@/components/motion";
import { PayoutReceipt } from "@/components/receipt";
import { Card, CardBody, CardHeader, Field, Flash, Money, Notice, StatusChip, fmtDate, fmtDateTime, inputClass } from "@/components/ui";
import { LedgerGroups, SettlementReceipt, SettlementStatus, receiptNo, type StatusStep } from "@/components/settlement";
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
  const processing = s.transfers.find((t) => t.state === "transfer_pending");
  const key = `settle:${c.root.id}`;
  // Receipt shown once, right after the brand pays out.
  const lastPaid = sp.receipt === "1" ? [...s.transfers].reverse().find((t) => t.state === "paid") : undefined;
  const lastPayoutGroup = lastPaid ? [...s.entries].reverse().find((e) => e.entryType === "payout")?.transactionGroupId : undefined;
  const receiptLines = lastPayoutGroup
    ? s.entries.filter((e) => e.transactionGroupId === lastPayoutGroup).map((e) => ({ label: ACCOUNTS[e.account as keyof typeof ACCOUNTS] ?? e.account, amountMinor: e.amountMinor }))
    : [];

  // Where the money is. One step per ledger stage; the current step is the one waiting on someone.
  const earned = r.totalMinor;
  const approved = s.settledToDate;
  const paid = s.balances.creator_paid;
  const held = s.balances.dispute_hold;
  const pending = s.pendingApprovalMinor;
  const payable = s.balances.creator_payable;
  const steps: StatusStep[] = [
    { label: "Earned", amountMinor: earned, state: earned > 0 ? "done" : "todo", note: earned > 0 ? `Under agreement v${c.active?.version ?? c.root.version}` : "Nothing earned yet" },
    {
      label: "Approved by brand",
      amountMinor: approved,
      state: pending > 0 ? "current" : approved > 0 ? "done" : "todo",
      note: pending > 0 ? `${formatINR(pending)} waiting for ${isBrand ? "your" : "brand"} approval` : approved > 0 ? "Up to date" : "Nothing to approve yet",
    },
    {
      label: "Paid out",
      amountMinor: paid,
      state: payable > 0 ? "current" : paid > 0 && pending <= 0 ? "done" : "todo",
      note: processing ? `Sending ${formatINR(processing.amountMinor)} now` : payable > 0 ? `${formatINR(payable)} ready to pay` : paid > 0 ? `Last paid ${fmtDate([...s.transfers].reverse().find((t) => t.state === "paid")?.createdAt)}` : "Nothing paid yet",
    },
    ...(held > 0 ? [{ label: "Held for dispute", amountMinor: held, state: "warn" as const, note: "Undisputed amount still payable" }] : []),
  ];
  const lastPaidAt = [...s.transfers].reverse().find((t) => t.state === "paid")?.createdAt;
  const stamp = earned > 0 && paid >= earned ? { word: "PAID", date: fmtDate(lastPaidAt, { day: "numeric", month: "short", year: "numeric" }) }
    : earned > 0 && pending <= 0 && approved >= earned ? { word: "APPROVED", date: "Payout pending" }
    : null;
  const counted = outcomeEvents.filter((e) => e.validityState === "valid").length;
  const notCounted = outcomeEvents.length - counted;

  return (
    <>
      <Flash sp={sp} />
      {(live || processing) && <AutoRefresh every={processing ? 3000 : 15000} />}
      {lastPaid && (
        <PayoutReceipt amountMinor={lastPaid.amountMinor} creator={c.creator.displayName} campaign={c.campaign.title} providerRef={lastPaid.providerRef ?? "mock"} when={fmtDateTime(lastPaid.createdAt)} lines={receiptLines} />
      )}
      <SettlementStatus steps={steps} />

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-8">
          <SettlementReceipt
            number={receiptNo(c.root.id, c.active?.version ?? c.root.version)}
            title="Settlement"
            parties={`${c.creator.displayName} for ${c.campaign.title}`}
            formulaText={describeFormula(f)}
            lines={r.lines}
            total={<CountUp value={r.totalMinor} format="inr" storageKey={`${key}:total`} />}
            stamp={stamp}
            notes={[
              ...(f.model === "hybrid" && r.deliverablesApproved < r.deliverablesTotal
                ? [`The ${formatINR(f.baseFeeMinor ?? 0)} base is added once all ${r.deliverablesTotal} deliverables are approved (${r.deliverablesApproved} of ${r.deliverablesTotal} so far).`]
                : []),
              `Counts events from the campaign dates plus ${f.attributionWindowDays} days. The same events and agreement version always give the same total.`,
            ]}
          />

          <Card>
            <CardHeader
              title={<span className="flex items-center gap-2">Evidence{live && <span className="inline-flex items-center gap-1.5 rounded-full bg-sunken px-2 py-0.5 text-[11px] font-semibold text-ink-2"><span className="h-1.5 w-1.5 rounded-full bg-good" />Updating</span>}</span>}
              description={<><CountUp value={counted} storageKey={`${key}:events`} /> counted, {notCounted} not counted, from {clicks.toLocaleString("en-IN")} tracked clicks.</>}
            />
            <NewRows storageKey={`${key}:evidence`} className="max-h-[420px] overflow-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="sticky top-0 bg-surface"><tr className="border-b border-line text-left text-[12.5px] font-semibold text-muted"><th className="px-6 py-2.5 font-medium">Counted</th><th className="px-3 py-2 font-medium">Type</th><th className="px-3 py-2 font-medium">When</th><th className="px-3 py-2 font-medium">Source</th><th className="px-6 py-2.5 text-right font-medium">Reference</th></tr></thead>
                <tbody className="divide-y divide-line-2">
                  {outcomeEvents.slice(0, 200).map((e) => (
                    <tr key={e.id} data-row-id={e.id} className={e.validityState !== "valid" ? "bg-bad-50/40" : undefined}>
                      <td className="px-6 py-2.5">{e.validityState === "valid" ? <span className="text-[13px] font-medium text-good">✓ Counted</span> : <StatusChip status={e.validityState} />}{e.reasonCode && <span className="ml-2 text-xs text-muted">{e.reasonCode.replace(/_/g, " ")}</span>}</td>
                      <td className="px-3 py-2 capitalize">{e.eventType}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-muted">{fmtDateTime(e.occurredAt)}</td>
                      <td className="px-3 py-2 text-xs text-muted">{e.source.replace(/_/g, " ")}</td>
                      <td className="px-6 py-2.5 text-right"><span title={e.eventId} className="figures text-xs text-faint">…{e.eventId.slice(-8)}</span></td>
                    </tr>
                  ))}
                  {outcomeEvents.length === 0 && <tr><td colSpan={5} className="px-6 py-8 text-center text-muted">No outcome events yet.</td></tr>}
                </tbody>
              </table>
            </NewRows>
          </Card>

          <Card>
            <CardHeader title="Ledger" description="Append-only. Each transaction nets to ₹0 across accounts." />
            {s.entries.length === 0 ? <p className="px-6 py-8 text-sm text-muted">Nothing has moved yet. Approving the settlement writes the first entries.</p> : (
              <NewRows storageKey={`${key}:ledger`}>
                <LedgerGroups entries={s.entries} />
              </NewRows>
            )}
          </Card>
        </div>

        <div className="space-y-8">
          {isBrand && (
            <Card>
              <CardHeader title={pending > 0 ? "Waiting for your approval" : processing ? "Payout processing" : payable > 0 ? "Ready to pay" : "Next step"} />
              <CardBody className="space-y-3">
                {c.campaign.fundingState !== "funded" && <Notice tone="warn">Fund the campaign before approving settlements.</Notice>}
                {s.pendingApprovalMinor > 0 && (
                  <form action={approveSettlementAction}>
                    <input type="hidden" name="agreementId" value={c.root.id} />
                    <input type="hidden" name="back" value={back} />
                    <SubmitButton variant="success" className="w-full" disabled={c.campaign.fundingState !== "funded"} pendingLabel="Approving…">Approve {formatINR(s.pendingApprovalMinor)}</SubmitButton>
                    <p className="mt-1.5 text-xs text-muted">Approves the amount earned since the last approval.{s.openDispute ? ` Up to ${formatINR(Math.max(0, s.openDispute.amountHeldMinor - s.balances.dispute_hold))} will be held for the open dispute.` : ""}</p>
                  </form>
                )}
                {s.pendingApprovalMinor < 0 && <Notice tone="warn">Earned is now {formatINR(-s.pendingApprovalMinor)} below what was approved (events were excluded). Open a dispute so operations can review an adjustment.</Notice>}
                {processing && <Notice tone="info">Payout of {formatINR(processing.amountMinor)} is processing. This page updates when the provider confirms.</Notice>}
                {s.balances.creator_payable > 0 && !processing && (
                  <form action={payoutAction}>
                    <input type="hidden" name="agreementId" value={c.root.id} />
                    <input type="hidden" name="back" value={back} />
                    <SubmitButton variant="success" className="w-full" pendingLabel="Paying…">Pay out {formatINR(s.balances.creator_payable)}</SubmitButton>
                    <p className="mt-1.5 text-xs text-muted">Test mode: the mock provider records the payout. No real money moves.</p>
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
                  <li key={t.id} className="flex items-center justify-between px-6 py-4 text-sm">
                    <div><Money minor={t.amountMinor} className="font-semibold" /><div title={t.providerRef ?? ""} className="text-[11px] text-muted">{t.providerRef ? `Ref …${t.providerRef.slice(-8)}` : "Waiting for provider"} · {fmtDate(t.createdAt)}</div></div>
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
                  <div className="mt-1 text-xs text-muted">Holding {formatINR(d.amountHeldMinor)}. Opened {fmtDateTime(d.createdAt)}.</div>
                  {d.resolution && <p className="mt-2 rounded bg-sunken px-2 py-1 text-xs">Resolution ({d.resolution.outcome}) by {d.resolution.by}: {d.resolution.reason}</p>}
                </div>
              ))}
              {s.disputes.length === 0 && <p className="text-muted">No disputes.</p>}
              {live && !s.openDispute && c.side !== "admin" && (
                <details>
                  <summary className="font-medium text-stamp">Open a dispute</summary>
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
