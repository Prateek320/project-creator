import Link from "next/link";
import { HandCoins, Landmark, Undo2, Vault } from "lucide-react";
import { getDb } from "@/db";
import { Card, CardHeader, EmptyState, Flash, Money, PageHeader, Stat, fmtDateTime } from "@/components/ui";
import { ACCOUNTS, balances } from "@/domain/ledger";
import { formatINR } from "@/domain/money";
import { brandLedger } from "@/server/finance";
import { requireActor } from "@/server/session";

export const metadata = { title: "Billing & ledger" };

const TYPE: Record<string, string> = { funding: "Campaign funded", settlement: "Settlement approved", payout: "Payout to creator", refund: "Refund to brand", reversal: "Reversal", dispute_hold: "Held for dispute", dispute_release: "Dispute released" };

export default async function Billing({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const actor = await requireActor("brand");
  const rows = await brandLedger(await getDb(), actor);
  const sp = await searchParams;
  const b = balances(rows.map((r) => r.entry));
  // Show one line per transaction group, from the perspective of the moving account.
  const groups = new Map<string, typeof rows>();
  for (const r of rows) groups.set(r.entry.transactionGroupId, [...(groups.get(r.entry.transactionGroupId) ?? []), r]);
  return (
    <>
      <Flash sp={sp} />
      <PageHeader title="Billing & ledger" description="An append-only, double-entry record of every funding, settlement, payout and refund. Corrections are new entries — nothing is overwritten." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat icon={Landmark} label="Funded" value={formatINR(-b.brand_external)} hint="Collected by payment provider (test)" />
        <Stat icon={Vault} label="Held at provider" value={formatINR(b.campaign_funds)} hint="Not yet approved for creators" />
        <Stat icon={HandCoins} label="Paid to creators" value={formatINR(b.creator_paid)} hint={`${formatINR(b.creator_payable)} approved, awaiting payout`} />
        <Stat icon={Undo2} label="Refunded" value={formatINR(b.brand_refund)} hint={`${formatINR(b.dispute_hold)} held for disputes`} />
      </div>
      <Card className="mt-8">
        <CardHeader title="Transactions" description="Test data — no real money has moved." />
        {groups.size === 0 ? <EmptyState title="No transactions yet" body="Fund a published campaign to see entries here." /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead><tr className="border-b border-line text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-muted"><th className="px-6 py-4 font-medium">When</th><th className="px-3 py-3 font-medium">Transaction</th><th className="px-3 py-3 font-medium">Campaign / creator</th><th className="px-3 py-3 font-medium">Entries</th><th className="px-6 py-4 text-right font-medium">Amount</th></tr></thead>
              <tbody className="divide-y divide-line-2">
                {[...groups.values()].map((g) => {
                  const first = g[0]!;
                  const amount = g.filter((x) => x.entry.amountMinor > 0).reduce((s, x) => s + x.entry.amountMinor, 0);
                  return (
                    <tr key={first.entry.transactionGroupId} className="align-top">
                      <td className="whitespace-nowrap px-6 py-4 text-xs text-muted">{fmtDateTime(first.entry.createdAt)}</td>
                      <td className="px-3 py-3"><div className="font-medium">{TYPE[first.entry.entryType] ?? first.entry.entryType}</div><div className="max-w-[260px] text-xs text-muted">{first.entry.memo}</div></td>
                      <td className="px-3 py-3"><Link className="hover:text-accent" href={first.entry.agreementId ? `/collaborations/${first.entry.agreementId}/settlement` : `/brand/campaigns/${first.campaign.id}`}>{first.campaign.title}</Link>{first.creator && <div className="text-xs text-muted">{first.creator.displayName}</div>}</td>
                      <td className="px-3 py-3 text-xs">
                        {g.map((x) => <div key={x.entry.id} className="flex justify-between gap-4"><span className="text-muted">{ACCOUNTS[x.entry.account as keyof typeof ACCOUNTS] ?? x.entry.account}</span><span className={`tnum whitespace-nowrap ${x.entry.amountMinor < 0 ? "text-bad" : "text-good"}`}>{x.entry.amountMinor > 0 ? "+" : "−"}{formatINR(Math.abs(x.entry.amountMinor))}</span></div>)}
                      </td>
                      <td className="px-6 py-4 text-right font-medium"><Money minor={amount} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
