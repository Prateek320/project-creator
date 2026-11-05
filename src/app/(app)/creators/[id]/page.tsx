import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { Avatar, Badge, ButtonLink, Card, CardBody, CardHeader, Money, PageHeader, ProvenanceChip, Stat, fmtDate, pct } from "@/components/ui";
import { formatCompact, formatINR } from "@/domain/money";
import { getCreatorProfile } from "@/server/creators";
import { requireActor } from "@/server/session";

const LABEL: Record<string, string> = { followers: "Followers", subscribers: "Subscribers", engagement_rate_bp: "Engagement rate", avg_reel_views: "Avg. Reel views", audience_female_pct: "Audience: women" };
const fmtMetric = (k: string, v: number) => (k === "engagement_rate_bp" ? `${(v / 100).toFixed(1)}%` : k.endsWith("_pct") ? `${v}%` : formatCompact(v));

export default async function CreatorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor();
  const { id } = await params;
  const data = await getCreatorProfile(await getDb(), actor, id).catch(() => null);
  if (!data) notFound();
  const { profile: p, accounts, portfolio, reputation: r, metrics, history, isOwner } = data;
  return (
    <>
      <PageHeader
        eyebrow={actor.role === "brand" ? <Link href="/brand/creators" className="hover:text-ink">← Discover creators</Link> : isOwner ? "Your public profile — this is what brands see" : undefined}
        title={<span className="flex flex-wrap items-center gap-3"><Avatar name={p.displayName} color={p.accent} size={48} />{p.displayName}{p.verificationState === "verified" && <Badge tone="good">ID verified</Badge>}</span>}
        description={`${p.headline} · ${p.location}`}
        actions={isOwner ? <ButtonLink href="/creator/profile" variant="secondary">Edit profile</ButtonLink> : undefined}
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Completed collaborations" value={r.completed} hint="On proovd" />
        <Stat label="On-time delivery" value={pct(r.onTimeRate)} hint="Approved deliverables submitted by due date" />
        <Stat label="Verified outcomes driven" value={r.verifiedOutcomes.toLocaleString("en-IN")} hint="Brand-verified, deduplicated" />
        <Stat label="Brand rating" value={r.avgRating ? `${r.avgRating.toFixed(1)} / 5` : "—"} hint="Moderated, structured reviews" />
      </div>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="space-y-8">
          <Card>
            <CardHeader title="About" />
            <CardBody className="space-y-3 text-sm">
              <p className="text-ink-2">{p.bio}</p>
              <div className="flex flex-wrap gap-1.5">{p.niches.map((n) => <Badge key={n} tone="accent" dot={false}>{n}</Badge>)}{p.languages.map((l) => <Badge key={l} dot={false}>{l}</Badge>)}</div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Verified track record" description="Completed collaborations with outcomes measured on the platform." />
            {history.length === 0 ? <p className="px-6 py-8 text-sm text-muted">No completed collaborations yet.</p> : (
              <ul className="divide-y divide-line-2">
                {history.map((h) => (
                  <li key={h.agreement.id} className="px-6 py-4 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{h.campaign.title}</span>
                      <span className="flex items-center gap-2">{h.rating && <span className="tnum text-xs text-muted">★ {h.rating}/5</span>}<Badge tone="good">{h.verified} verified {h.campaign.compensation.outcomeEvent ?? "outcome"}s</Badge></span>
                    </div>
                    {h.comment && <p className="mt-1 text-muted">“{h.comment}”</p>}
                    <div className="mt-1 text-xs text-muted">{fmtDate(h.campaign.startAt, { month: "short", year: "numeric" })}</div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <CardHeader title="Portfolio" />
            {portfolio.length === 0 ? <p className="px-6 py-8 text-sm text-muted">No portfolio items yet.</p> : (
              <ul className="grid gap-3 p-5 sm:grid-cols-2">
                {portfolio.map((it) => (
                  <li key={it.id} className="rounded-2xl border border-line p-4">
                    <div className="text-xs text-muted">{it.platform}{it.brandName ? ` · ${it.brandName}` : ""}</div>
                    <a href={it.url} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 block font-medium hover:text-accent">{it.title} ↗</a>
                    {it.resultSummary && <div className="mt-1 text-sm text-muted">{it.resultSummary}</div>}
                    <div className="mt-2 text-[11px] text-muted">Results as stated by creator</div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <div className="space-y-8">
          <Card>
            <CardHeader title="Audience & accounts" description="Source and freshness shown for every number." />
            <ul className="divide-y divide-line-2">
              {accounts.map((a) => (
                <li key={a.id} className="px-6 py-4 text-sm">
                  <div className="flex items-center justify-between"><span className="font-medium">{a.platform} · @{a.handle}</span><span className="text-xs text-muted">{a.connectionState === "connected_api" ? "Connected" : a.connectionState === "manual_evidence" ? "Manual evidence" : "Disconnected"}</span></div>
                  <dl className="mt-2 space-y-1.5">
                    {metrics.filter((m) => m.socialAccountId === a.id).map((m) => (
                      <div key={m.id} className="flex items-center justify-between gap-2">
                        <dt className="text-muted">{LABEL[m.metricKey] ?? m.metricKey}</dt>
                        <dd className="flex items-center gap-2"><span className="tnum font-medium">{fmtMetric(m.metricKey, m.valueNumeric)}</span><ProvenanceChip status={m.verificationStatus} observedAt={m.observedAt} /></dd>
                      </div>
                    ))}
                  </dl>
                </li>
              ))}
              {metrics.filter((m) => !m.socialAccountId).map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 px-6 py-4 text-sm">
                  <span className="text-muted">{LABEL[m.metricKey] ?? m.metricKey}</span>
                  <span className="flex items-center gap-2"><span className="tnum font-medium">{fmtMetric(m.metricKey, m.valueNumeric)}</span><ProvenanceChip status={m.verificationStatus} observedAt={m.observedAt} /></span>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Rates" />
            <CardBody className="text-sm">
              <div className="tnum text-xl font-semibold">{formatINR(p.rateMinMinor)} – <Money minor={p.rateMaxMinor} /></div>
              <div className="mt-1 text-muted">per deliverable package · {p.availability === "available" ? "Available for new work" : "Currently busy"}</div>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
