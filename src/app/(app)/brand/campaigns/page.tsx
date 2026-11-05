import Link from "next/link";
import { getDb } from "@/db";
import { describeFormula } from "@/domain/compensation";
import { ButtonLink, Card, EmptyState, Flash, Money, PageHeader, StatusChip, fmtDate } from "@/components/ui";
import { listBrandCampaigns } from "@/server/campaigns";
import { requireActor } from "@/server/session";

export const metadata = { title: "Campaigns" };

export default async function Campaigns({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const actor = await requireActor("brand");
  const rows = await listBrandCampaigns(await getDb(), actor);
  const sp = await searchParams;
  const filter = sp.status ?? "all";
  const shown = filter === "all" ? rows : rows.filter((r) => r.campaign.status === filter);
  const counts = (s: string) => rows.filter((r) => r.campaign.status === s).length;
  return (
    <>
      <Flash sp={sp} />
      <PageHeader title="Campaigns" description="Every campaign carries a versioned brief, budget and payout formula." actions={<ButtonLink href="/brand/campaigns/new">New campaign</ButtonLink>} />
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter by status">
        {[["all", "All", rows.length], ["published", "Live", counts("published")], ["draft", "Drafts", counts("draft")], ["paused", "Paused", counts("paused")], ["completed", "Completed", counts("completed")]].map(([k, l, n]) => (
          <Link key={k} href={k === "all" ? "/brand/campaigns" : `/brand/campaigns?status=${k}`} aria-current={filter === k ? "true" : undefined}
            className={`rounded-full border px-4 py-2 text-[13px] font-semibold ${filter === k ? "border-transparent bg-lime font-semibold text-ink" : "border-black/[0.06] bg-white/70 text-ink-2 transition-colors hover:bg-white/60"}`}>
            {l} <span className="tnum text-muted">{n}</span>
          </Link>
        ))}
      </div>
      <Card>
        {shown.length === 0 ? (
          <EmptyState title="No campaigns here" body="Create a campaign to start receiving applications." action={<ButtonLink href="/brand/campaigns/new">New campaign</ButtonLink>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-muted">
                  <th className="px-6 py-4 font-medium">Campaign</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Payout formula</th>
                  <th className="px-3 py-3 text-right font-medium">Budget</th>
                  <th className="px-3 py-3 text-right font-medium">Applicants</th>
                  <th className="px-6 py-4 text-right font-medium">Creators</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-2">
                {shown.map(({ campaign: c, applicants, accepted }) => (
                  <tr key={c.id} className="transition-colors hover:bg-white/60">
                    <td className="px-6 py-4">
                      <Link href={`/brand/campaigns/${c.id}`} className="font-medium text-ink hover:text-accent">{c.title}</Link>
                      <div className="text-xs text-muted">{c.niche} · {fmtDate(c.startAt)} – {fmtDate(c.endAt)}</div>
                    </td>
                    <td className="px-3 py-3"><div className="flex flex-col items-start gap-1"><StatusChip status={c.status} />{c.status !== "draft" && <StatusChip status={c.fundingState} />}</div></td>
                    <td className="max-w-[280px] px-3 py-3 text-ink-2">{describeFormula(c.compensation)}</td>
                    <td className="px-3 py-3 text-right"><Money minor={c.budgetMinor} /></td>
                    <td className="tnum px-3 py-3 text-right">{applicants}</td>
                    <td className="tnum px-6 py-4 text-right">{accepted} / {c.creatorSlots}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
