import Link from "next/link";
import { getDb } from "@/db";
import { Avatar, Badge, ButtonLink, Card, EmptyState, PageHeader, ProvenanceChip, inputClass, pct } from "@/components/ui";
import { formatCompact, formatINR } from "@/domain/money";
import { AUDIENCE_BANDS, CHANNELS, NICHES, discoverCreators } from "@/server/creators";
import { requireActor } from "@/server/session";

export const metadata = { title: "Discover creators" };

export default async function DiscoverCreators({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireActor("brand");
  const sp = await searchParams;
  const db = await getDb();
  const { items, nextCursor } = await discoverCreators(db, { q: sp.q, niche: sp.niche, channel: sp.channel, band: sp.band, location: sp.location, cursor: sp.cursor });
  const qs = (extra: Record<string, string>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...extra })) if (v && k !== "cursor") p.set(k, v);
    if (extra.cursor) p.set("cursor", extra.cursor);
    return `?${p.toString()}`;
  };
  return (
    <>
      <PageHeader title="Discover creators" description="Ranked by recency, never by an opaque score. Track record comes from completed, verified collaborations." />
      <Card className="mb-5 p-4">
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1fr_auto]" role="search">
          <input name="q" defaultValue={sp.q} placeholder="Search name, niche, keywords" aria-label="Search" className={inputClass} />
          <select name="niche" defaultValue={sp.niche ?? ""} aria-label="Niche" className={inputClass}><option value="">All niches</option>{NICHES.map((n) => <option key={n}>{n}</option>)}</select>
          <select name="channel" defaultValue={sp.channel ?? ""} aria-label="Channel" className={inputClass}><option value="">All channels</option>{CHANNELS.map((n) => <option key={n}>{n}</option>)}</select>
          <select name="band" defaultValue={sp.band ?? ""} aria-label="Audience size" className={inputClass}><option value="">Any audience size</option>{AUDIENCE_BANDS.map((n) => <option key={n}>{n}</option>)}</select>
          <input name="location" defaultValue={sp.location} placeholder="City" aria-label="City" className={inputClass} />
          <button className="h-10 rounded-lg bg-ink px-4 text-sm font-medium text-white">Apply</button>
        </form>
      </Card>
      {items.length === 0 ? (
        <Card><EmptyState title="No creators match these filters" body="Try widening the audience size or removing the city filter." action={<ButtonLink variant="secondary" href="/brand/creators">Clear filters</ButtonLink>} /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map(({ profile: p, reputation: r, accounts, metrics }) => {
            const followers = metrics.filter((m) => m.metricKey === "followers" || m.metricKey === "subscribers");
            const er = metrics.find((m) => m.metricKey === "engagement_rate_bp");
            return (
              <Card key={p.id} className="flex flex-col p-5">
                <div className="flex items-start gap-3">
                  <Avatar name={p.displayName} color={p.accent} size={44} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/creators/${p.id}`} className="font-semibold hover:text-accent">{p.displayName}</Link>
                    <div className="truncate text-sm text-muted">{p.headline}</div>
                    <div className="mt-1 text-xs text-muted">{p.location} · {p.niches.join(", ")}</div>
                  </div>
                  {p.verificationState === "verified" && <Badge tone="good">Verified</Badge>}
                </div>
                <div className="mt-4 space-y-1.5 text-sm">
                  {followers.map((m) => (
                    <div key={m.id} className="flex items-center justify-between">
                      <span className="text-muted">{accounts.find((a) => a.id === m.socialAccountId)?.platform}</span>
                      <span className="flex items-center gap-2"><span className="tnum font-medium">{formatCompact(m.valueNumeric)}</span><ProvenanceChip status={m.verificationStatus} observedAt={m.observedAt} /></span>
                    </div>
                  ))}
                  {er && <div className="flex items-center justify-between"><span className="text-muted">Engagement</span><span className="flex items-center gap-2"><span className="tnum font-medium">{(er.valueNumeric / 100).toFixed(1)}%</span><ProvenanceChip status={er.verificationStatus} /></span></div>}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center">
                  <div><div className="tnum text-sm font-semibold">{r.completed}</div><div className="text-[11px] text-muted">completed</div></div>
                  <div><div className="tnum text-sm font-semibold">{pct(r.onTimeRate)}</div><div className="text-[11px] text-muted">on time</div></div>
                  <div><div className="tnum text-sm font-semibold">{r.verifiedOutcomes.toLocaleString("en-IN")}</div><div className="text-[11px] text-muted">verified results</div></div>
                </div>
                <div className="mt-auto flex items-center justify-between pt-4 text-sm">
                  <span className="text-muted">{formatINR(p.rateMinMinor)}–{formatINR(p.rateMaxMinor)}</span>
                  <Link href={`/creators/${p.id}`} className="font-medium text-accent">View profile →</Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {nextCursor && <div className="mt-6 text-center"><ButtonLink variant="secondary" href={qs({ cursor: nextCursor })}>Load more</ButtonLink></div>}
    </>
  );
}
