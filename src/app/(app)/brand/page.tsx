import Link from "next/link";
import { getDb } from "@/db";
import { formatINR } from "@/domain/money";
import { Avatar, ButtonLink, Card, CardHeader, EmptyState, Flash, Money, PageHeader, Stat, StatusChip, fmtDate, relDays } from "@/components/ui";
import { brandOverview } from "@/server/dashboards";
import { requireActor } from "@/server/session";

export const metadata = { title: "Overview" };

export default async function BrandOverview({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const actor = await requireActor("brand");
  const db = await getDb();
  const o = await brandOverview(db, actor);
  const sp = await searchParams;
  const attention = o.review.length + o.newApps.length + o.settle.length + o.disputesOpen.length;

  return (
    <>
      <Flash sp={sp} />
      <PageHeader
        title={`Good to see you, ${actor.name.split(" ")[0]}`}
        description={attention ? `${attention} thing${attention > 1 ? "s" : ""} need your attention.` : "You're all caught up."}
        actions={<ButtonLink href="/brand/campaigns/new">New campaign</ButtonLink>}
      />
      {!o.stats ? (
        <Card><EmptyState title="Launch your first campaign" body="Set an objective, deliverables and a payout formula. Creators see every material term before they apply." action={<ButtonLink href="/brand/campaigns/new">Create campaign</ButtonLink>} /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Live campaigns" value={o.stats.live} hint={`${o.camps.length} total`} />
            <Stat label="Verified outcomes" value={o.stats.outcomes.toLocaleString("en-IN")} hint="Signed brand events, deduplicated" />
            <Stat label="Approved for creators" value={formatINR(o.stats.committed)} hint={`${formatINR(o.stats.paidOut)} paid out`} />
            <Stat label="Held at payment provider" value={formatINR(o.stats.held)} hint={`${formatINR(o.stats.funded)} funded in total (test mode)`} />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Content waiting for your review" description="Creators are paid against approved deliverables — quick reviews keep things fair." />
              {o.review.length === 0 ? (
                <p className="px-5 py-6 text-sm text-muted">Nothing to review.</p>
              ) : (
                <ul className="divide-y divide-line-2">
                  {o.review.map(({ d, creator, campaign, agreement }) => (
                    <li key={d.id} className="flex items-center gap-3 px-5 py-3">
                      <Avatar name={creator.displayName} color={creator.accent} size={32} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{creator.displayName} · {d.title}</div>
                        <div className="truncate text-xs text-muted">{campaign.title} · submitted {d.submittedAt ? relDays(d.submittedAt) : ""}</div>
                      </div>
                      <ButtonLink size="sm" variant="secondary" href={`/collaborations/${agreement.id}`}>Review</ButtonLink>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <CardHeader title="Settlements to approve" description="Calculated from the accepted agreement and verified events." />
              {o.settle.length === 0 ? (
                <p className="px-5 py-6 text-sm text-muted">No settlements pending.</p>
              ) : (
                <ul className="divide-y divide-line-2">
                  {o.settle.map((s) => (
                    <li key={s.rootId} className="flex items-center gap-3 px-5 py-3">
                      <Avatar name={s.creator.displayName} color={s.creator.accent} size={32} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{s.creator.displayName}</div>
                        <div className="truncate text-xs text-muted">{s.campaign.title}</div>
                      </div>
                      <div className="text-right text-sm">
                        {s.pending > 0 && <div><Money minor={s.pending} /> <span className="text-xs text-muted">to approve</span></div>}
                        {s.payable > 0 && <div><Money minor={s.payable} /> <span className="text-xs text-muted">to pay</span></div>}
                      </div>
                      <ButtonLink size="sm" variant="secondary" href={`/collaborations/${s.rootId}/settlement`}>Open</ButtonLink>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <CardHeader title="New applications" />
              {o.newApps.length === 0 ? (
                <p className="px-5 py-6 text-sm text-muted">No new applications.</p>
              ) : (
                <ul className="divide-y divide-line-2">
                  {o.newApps.slice(0, 6).map(({ app, creator, campaign }) => (
                    <li key={app.id} className="flex items-center gap-3 px-5 py-3">
                      <Avatar name={creator.displayName} color={creator.accent} size={32} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{creator.displayName}</div>
                        <div className="truncate text-xs text-muted">{campaign.title} · asks <Money minor={app.proposedRateMinor} /></div>
                      </div>
                      <ButtonLink size="sm" variant="secondary" href={`/brand/campaigns/${campaign.id}/applications`}>Compare</ButtonLink>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <CardHeader title="Campaigns" actions={<Link className="text-sm font-medium text-accent" href="/brand/campaigns">View all</Link>} />
              <ul className="divide-y divide-line-2">
                {o.camps.slice(0, 5).map((c) => (
                  <li key={c.id}>
                    <Link href={`/brand/campaigns/${c.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{c.title}</div>
                        <div className="text-xs text-muted">{fmtDate(c.startAt)} – {fmtDate(c.endAt)} · <Money minor={c.budgetMinor} /></div>
                      </div>
                      <StatusChip status={c.status} />
                    </Link>
                  </li>
                ))}
              </ul>
              {o.disputesOpen.length > 0 && (
                <div className="border-t border-line-2 px-5 py-3 text-sm">
                  <span className="font-medium text-bad">{o.disputesOpen.length} open dispute{o.disputesOpen.length > 1 ? "s" : ""}</span>
                  <span className="text-muted"> · {o.disputesOpen.map((d) => d.campaign.title).join(", ")}</span>
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </>
  );
}
