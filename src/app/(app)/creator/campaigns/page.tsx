import Link from "next/link";
import { getDb } from "@/db";
import { Avatar, Badge, ButtonLink, Card, EmptyState, PageHeader, fmtDate, inputClass } from "@/components/ui";
import { describeFormula, maxPayout } from "@/domain/compensation";
import { formatINR } from "@/domain/money";
import { discoverCampaigns } from "@/server/campaigns";
import { CHANNELS, NICHES } from "@/server/creators";
import { requireActor } from "@/server/session";

export const metadata = { title: "Discover campaigns" };
const MODEL: Record<string, string> = { fixed: "Fixed fee", performance: "Performance", hybrid: "Hybrid" };

export default async function DiscoverCampaigns({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireActor("creator");
  const sp = await searchParams;
  const { items, nextCursor } = await discoverCampaigns(await getDb(), { q: sp.q, niche: sp.niche, channel: sp.channel, model: sp.model, cursor: sp.cursor });
  const more = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "cursor") as [string, string][]);
  if (nextCursor) more.set("cursor", nextCursor);
  return (
    <>
      <PageHeader title="Discover campaigns" description="Every listing shows the budget, deliverables, rights and payout formula before you apply." />
      <form role="search" className="mb-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr_auto]">
        <input name="q" defaultValue={sp.q} placeholder="Search campaigns or brands" aria-label="Search" className={inputClass} />
        <select name="niche" defaultValue={sp.niche ?? ""} aria-label="Category" className={inputClass}><option value="">All categories</option>{NICHES.map((n) => <option key={n}>{n}</option>)}</select>
        <select name="channel" defaultValue={sp.channel ?? ""} aria-label="Channel" className={inputClass}><option value="">All channels</option>{CHANNELS.map((n) => <option key={n}>{n}</option>)}</select>
        <select name="model" defaultValue={sp.model ?? ""} aria-label="Pay model" className={inputClass}><option value="">Any pay model</option><option value="fixed">Fixed fee</option><option value="hybrid">Hybrid</option><option value="performance">Performance</option></select>
        <button className="h-10 rounded-lg bg-ink px-4 text-sm font-medium text-white">Search</button>
      </form>
      {items.length === 0 ? (
        <Card><EmptyState title="No campaigns match" body="Try another category or pay model." action={<ButtonLink variant="secondary" href="/creator/campaigns">Clear filters</ButtonLink>} /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map(({ campaign: c, brand }) => (
            <Link key={c.id} href={`/creator/campaigns/${c.id}`} className="group block">
              <Card className="h-full p-5 transition-colors group-hover:border-accent">
                <div className="flex items-start gap-3">
                  <Avatar name={brand.displayName} color="#0f172a" size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-muted">{brand.displayName}{brand.verificationState === "verified" ? " · verified business" : ""}</div>
                    <h2 className="font-semibold group-hover:text-accent">{c.title}</h2>
                  </div>
                  <Badge tone={c.compensation.model === "performance" ? "warn" : c.compensation.model === "hybrid" ? "accent" : "good"}>{MODEL[c.compensation.model]}</Badge>
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-ink-2">{c.brief}</p>
                <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm">
                  <div className="font-medium">{describeFormula(c.compensation)}</div>
                  <div className="mt-0.5 text-xs text-muted">Up to {formatINR(maxPayout(c.compensation, c.measurement.target * 3))} per creator · {c.creatorSlots} slot{c.creatorSlots > 1 ? "s" : ""}</div>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                  <span>{c.channels.join(" · ")}</span>
                  <span>{fmtDate(c.startAt)} – {fmtDate(c.endAt)}</span>
                  {c.applyBy && <span>Apply by {fmtDate(c.applyBy)}</span>}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
      {nextCursor && <div className="mt-6 text-center"><ButtonLink variant="secondary" href={`?${more.toString()}`}>Load more</ButtonLink></div>}
    </>
  );
}
