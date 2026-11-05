import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { resolveDisputeAction, reverseTransferAction } from "@/app/actions";
import { SubmitButton } from "@/components/client";
import { Card, CardBody, CardHeader, Field, Flash, Money, PageHeader, StatusChip, fmtDateTime, inputClass } from "@/components/ui";
import { describeFormula } from "@/domain/compensation";
import { formatINR } from "@/domain/money";
import { getDispute } from "@/server/admin";
import { getSettlement } from "@/server/finance";
import { requireActor } from "@/server/session";

export default async function DisputeReview({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const actor = await requireActor("admin");
  const { id } = await params;
  const sp = await searchParams;
  const db = await getDb();
  const data = await getDispute(db, actor, id).catch(() => null);
  if (!data) notFound();
  const { dispute: d, trail } = data;
  const s = await getSettlement(db, actor, d.agreementId);
  const [opener] = await db.select().from(schema.users).where(eq(schema.users.id, d.openedByUserId));
  const open = d.state === "open" || d.state === "under_review";
  const back = `/admin/disputes/${d.id}`;
  return (
    <>
      <PageHeader eyebrow={<Link href="/admin/queue" className="hover:text-ink">← Queue</Link>} title={<span className="flex items-center gap-3 capitalize">{d.category.replace(/_/g, " ")} <StatusChip status={d.state} /></span>} description={`${s.collab.campaign.title} · ${s.collab.creator.displayName} · opened by ${opener?.name}`} />
      <Flash sp={sp} />
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-8">
          <Card>
            <CardHeader title="Claim" />
            <CardBody className="space-y-2 text-sm"><p>{d.description}</p><p className="text-muted">Hold requested: {formatINR(d.amountHeldMinor)} · {fmtDateTime(d.createdAt)}</p></CardBody>
          </Card>
          <Card>
            <CardHeader title="Agreement & settlement" description={describeFormula(s.formula)} />
            <CardBody>
              <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div><dt className="text-xs text-muted">Earned</dt><dd className="font-semibold"><Money minor={s.result.totalMinor} /></dd></div>
                <div><dt className="text-xs text-muted">Paid</dt><dd className="font-semibold"><Money minor={s.balances.creator_paid} /></dd></div>
                <div><dt className="text-xs text-muted">Payable</dt><dd className="font-semibold"><Money minor={s.balances.creator_payable} /></dd></div>
                <div><dt className="text-xs text-muted">Held</dt><dd className="font-semibold"><Money minor={s.balances.dispute_hold} /></dd></div>
              </dl>
              <ul className="mt-4 space-y-1 text-sm">{s.result.lines.map((l) => <li key={l.label} className="flex justify-between"><span className="text-muted">{l.label} · {l.detail}</span><span className="tnum">{formatINR(l.amountMinor)}</span></li>)}</ul>
              <Link href={`/collaborations/${s.collab.root.id}/settlement`} className="mt-3 inline-block text-sm font-medium text-accent">Open full evidence →</Link>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Payouts" description="Reversal appends compensating ledger entries." />
            <ul className="divide-y divide-line-2">
              {s.transfers.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-3 px-6 py-4 text-sm">
                  <span className="flex-1"><Money minor={t.amountMinor} /> · <span className="font-mono text-xs">{t.providerRef}</span></span>
                  <StatusChip status={t.state} />
                  {t.state === "paid" && (
                    <form action={reverseTransferAction} className="flex gap-2">
                      <input type="hidden" name="transferId" value={t.id} />
                      <input type="hidden" name="back" value={back} />
                      <input name="reason" aria-label="Reason" placeholder="Reason" className={`${inputClass} h-8 w-40 py-1`} />
                      <SubmitButton size="sm" variant="danger" confirm="Reverse this payout?">Reverse</SubmitButton>
                    </form>
                  )}
                </li>
              ))}
              {s.transfers.length === 0 && <li className="px-6 py-5 text-sm text-muted">No payouts.</li>}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Audit trail" />
            <ul className="divide-y divide-line-2">{trail.map((t) => <li key={t.id} className="px-6 py-3 text-sm">{t.action} <span className="text-xs text-muted">· {fmtDateTime(t.createdAt)}{t.reason ? ` · ${t.reason}` : ""}</span></li>)}</ul>
          </Card>
        </div>
        <Card className="lg:sticky lg:top-20 lg:self-start">
          <CardHeader title="Resolve" description={open ? `Currently held: ${formatINR(s.balances.dispute_hold)}` : "This dispute is closed."} />
          <CardBody>
            {open ? (
              <form action={resolveDisputeAction} className="space-y-4">
                <input type="hidden" name="disputeId" value={d.id} />
                <input type="hidden" name="back" value={back} />
                <Field label="Outcome" htmlFor="outcome">
                  <select id="outcome" name="outcome" className={inputClass}>
                    <option value="split">Split the held amount</option>
                    <option value="upheld">Uphold the claim</option>
                    <option value="rejected">Reject the claim</option>
                  </select>
                </Field>
                <Field label="Release to creator (₹)" htmlFor="creatorShare" hint={`Between ₹0 and ${formatINR(s.balances.dispute_hold)}. The rest returns to campaign funds.`}>
                  <input id="creatorShare" name="creatorShare" inputMode="decimal" defaultValue={String(s.balances.dispute_hold / 200)} className={inputClass} />
                </Field>
                <Field label="Reason (shown to both parties)" htmlFor="reason"><textarea id="reason" name="reason" rows={3} required minLength={10} className={inputClass} /></Field>
                <SubmitButton className="w-full">Record resolution</SubmitButton>
                <p className="text-xs text-muted">Production: requires MFA re-authentication for this action.</p>
              </form>
            ) : (
              <p className="text-sm">{d.resolution?.outcome}: {d.resolution?.reason}</p>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
