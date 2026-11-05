import Link from "next/link";
import { getDb } from "@/db";
import { Card, CardHeader, EmptyState, PageHeader, Stat, fmtDateTime } from "@/components/ui";
import { formatINR } from "@/domain/money";
import { creatorEarnings } from "@/server/finance";
import { requireActor } from "@/server/session";

export const metadata = { title: "Earnings" };

const LABEL: Record<string, [string, string]> = {
  "settlement:creator_payable": ["Earnings approved", "good"],
  "settlement:dispute_hold": ["Approved, held for dispute", "warn"],
  "payout:creator_paid": ["Paid to you", "good"],
  "dispute_hold:dispute_hold": ["Moved to dispute hold", "warn"],
  "dispute_release:creator_payable": ["Released from dispute", "good"],
  "reversal:creator_paid": ["Payout reversed", "bad"],
};

export default async function Earnings() {
  const actor = await requireActor("creator");
  const { entries, balances: b } = await creatorEarnings(await getDb(), actor);
  const mine = entries.filter((e) => ["creator_payable", "creator_paid", "dispute_hold"].includes(e.entry.account) && e.entry.amountMinor > 0);
  return (
    <>
      <PageHeader title="Earnings" description="Every rupee links back to the agreement version and the verified evidence it was calculated from." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Paid to you" value={formatINR(b.creator_paid)} hint="Via payment provider (test mode)" />
        <Stat label="Approved, awaiting payout" value={formatINR(b.creator_payable)} />
        <Stat label="Held for open disputes" value={formatINR(b.dispute_hold)} hint="Only the disputed portion is held" tone={b.dispute_hold ? "warn" : undefined} />
      </div>
      <Card className="mt-8">
        <CardHeader title="History" />
        {mine.length === 0 ? <EmptyState title="No earnings yet" body="Earnings appear here when a brand approves a settlement." /> : (
          <ul className="divide-y divide-line-2">
            {mine.map(({ entry, campaign, brand }) => {
              const [label, tone] = LABEL[`${entry.entryType}:${entry.account}`] ?? [entry.entryType, "neutral"];
              return (
                <li key={entry.id} className="flex flex-wrap items-center gap-3 px-6 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{label}</div>
                    <div className="text-xs text-muted">{campaign.title} · {brand.displayName} · {fmtDateTime(entry.createdAt)}</div>
                  </div>
                  <span className={`tnum font-semibold ${tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : "text-ink"}`}>{formatINR(entry.amountMinor)}</span>
                  {entry.agreementId && <Link href={`/collaborations/${entry.agreementId}/settlement`} className="text-sm font-medium text-accent">How it was calculated →</Link>}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
