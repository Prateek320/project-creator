import Link from "next/link";
import { getDb } from "@/db";
import { Avatar, ButtonLink, Card, CardHeader, Flash, Money, PageHeader, Progress, Stat, StatusChip, fmtDate, relDays } from "@/components/ui";
import { describeFormula } from "@/domain/compensation";
import { formatINR } from "@/domain/money";
import { discoverCampaigns } from "@/server/campaigns";
import { creatorHome } from "@/server/dashboards";
import { requireActor } from "@/server/session";

export const metadata = { title: "Home" };

export default async function CreatorHome({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const actor = await requireActor("creator");
  const db = await getDb();
  const h = await creatorHome(db, actor);
  const sp = await searchParams;
  const suggested = await discoverCampaigns(db, { niche: h.profile.primaryNiche, limit: 3 });
  return (
    <>
      <Flash sp={sp} />
      <PageHeader title={`Hi ${actor.name.split(" ")[0]}`} description="Here's what needs you today." actions={<ButtonLink href="/creator/campaigns">Find campaigns</ButtonLink>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Paid out" value={formatINR(h.balances.creator_paid)} hint="Lifetime, via payment provider (test)" />
        <Stat label="Approved, on its way" value={formatINR(h.balances.creator_payable)} hint={h.balances.dispute_hold ? `${formatINR(h.balances.dispute_hold)} held in a dispute` : "Ready for payout"} tone={h.balances.dispute_hold ? "warn" : undefined} />
        <Stat label="Open applications" value={h.openApps} />
        <Card className="px-5 py-4">
          <div className="text-[13px] font-medium text-muted">Profile strength</div>
          <div className="tnum mt-1.5 text-[26px] font-semibold">{h.strength}%</div>
          <div className="mt-2"><Progress value={h.strength} max={100} label="Profile strength" /></div>
          {h.strength < 100 && <Link href="/creator/profile" className="mt-2 inline-block text-xs font-medium text-accent">Complete your profile →</Link>}
        </Card>
      </div>

      {h.offers.length > 0 && (
        <Card className="mt-6 border-amber-200">
          <CardHeader title="Offers waiting for you" description="Read the terms. Nothing is binding until you accept." />
          <ul className="divide-y divide-line-2">
            {h.offers.map(({ agreement, campaign, brand }) => (
              <li key={agreement.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{campaign.title} <span className="font-normal text-muted">· {brand.displayName}{agreement.version > 1 ? ` · amendment v${agreement.version}` : ""}</span></div>
                  <div className="text-xs text-muted">{describeFormula(agreement.formulaSnapshot)}</div>
                </div>
                <ButtonLink size="sm" href={`/collaborations/${agreement.id}`}>Review offer</ButtonLink>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Your to-do list" description="Deliverables due or needing changes" />
          {h.todo.length === 0 ? <p className="px-5 py-6 text-sm text-muted">Nothing due. Nice.</p> : (
            <ul className="divide-y divide-line-2">
              {h.todo.map(({ d, campaign, agreement }) => (
                <li key={d.id}>
                  <Link href={`/collaborations/${agreement.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{d.title} <span className="font-normal text-muted">· {campaign.title}</span></div>
                      <div className={`text-xs ${d.dueAt < new Date() ? "text-bad" : "text-muted"}`}>Due {fmtDate(d.dueAt)} ({relDays(d.dueAt)})</div>
                    </div>
                    <StatusChip status={d.approvalState} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title={`New in ${h.profile.primaryNiche}`} actions={<Link className="text-sm font-medium text-accent" href="/creator/campaigns">Browse all</Link>} />
          {suggested.items.length === 0 ? <p className="px-5 py-6 text-sm text-muted">No open campaigns in your niche right now.</p> : (
            <ul className="divide-y divide-line-2">
              {suggested.items.map(({ campaign: c, brand }) => (
                <li key={c.id}>
                  <Link href={`/creator/campaigns/${c.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                    <Avatar name={brand.displayName} color="#0f172a" size={32} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{c.title}</div>
                      <div className="truncate text-xs text-muted">{brand.displayName} · {describeFormula(c.compensation)}</div>
                    </div>
                    <Money minor={c.budgetMinor} className="text-xs text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
