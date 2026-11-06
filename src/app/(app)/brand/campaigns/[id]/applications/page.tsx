import Link from "next/link";
import { inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { applicationStatusAction, offerAction } from "@/app/actions";
import { SubmitButton } from "@/components/client";
import { FormulaFields } from "@/components/formula";
import { Avatar, Card, EmptyState, Flash, Money, SourceMark, StatusChip, buttonClass, cx, inputClass, pct } from "@/components/ui";
import { formatCompact } from "@/domain/money";
import { listCampaignApplications } from "@/server/collaborations";
import { latestMetrics, matchReasons, reputationFor } from "@/server/creators";
import { requireActor } from "@/server/session";

export const metadata = { title: "Applications" };

const FILTERS = [
  ["all", "All"],
  ["submitted", "New"],
  ["shortlisted", "Shortlisted"],
  ["offered", "Offered"],
  ["accepted", "Hired"],
  ["rejected", "Declined"],
] as const;

export default async function Applications({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const actor = await requireActor("brand");
  const { id } = await params;
  const sp = await searchParams;
  const db = await getDb();
  const { campaign, rows } = await listCampaignApplications(db, actor, id);
  const ids = rows.map((r) => r.creator.id);
  const [rep, metrics, accounts, agreements] = await Promise.all([
    reputationFor(db, ids),
    ids.length ? latestMetrics(db, ids) : Promise.resolve(new Map()),
    ids.length ? db.select().from(schema.socialAccounts).where(inArray(schema.socialAccounts.creatorProfileId, ids)) : Promise.resolve([]),
    db.select().from(schema.agreements).where(inArray(schema.agreements.applicationId, rows.map((r) => r.app.id).length ? rows.map((r) => r.app.id) : ["00000000-0000-0000-0000-000000000000"])),
  ]);
  const filter = sp.filter ?? "all";
  const mode = sp.view === "compare" ? "compare" : "list";
  const shown = filter === "all" ? rows : rows.filter((r) => r.app.status === filter);
  const base = `/brand/campaigns/${campaign.id}/applications`;
  const qs = (o: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const merged = { filter: filter !== "all" ? filter : undefined, view: mode === "compare" ? "compare" : undefined, ...o };
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
    const str = q.toString();
    return `${base}${str ? `?${str}` : ""}`;
  };
  const back = qs({});
  const hired = rows.filter((r) => r.app.status === "accepted" || r.app.status === "offered").length;

  // Everything both views need about one applicant, derived once.
  const cards = shown.map(({ app, creator }) => {
    const r = rep.get(creator.id);
    const ms = (metrics.get(creator.id) ?? []) as (typeof schema.metricSnapshots.$inferSelect)[];
    const accts = accounts.filter((a) => a.creatorProfileId === creator.id);
    const audience = ms
      .filter((m) => m.metricKey === "followers" || m.metricKey === "subscribers")
      .map((m) => ({ id: m.id, platform: accts.find((a) => a.id === m.socialAccountId)?.platform ?? "Audience", value: formatCompact(m.valueNumeric), source: m.verificationStatus }));
    const er = ms.find((m) => m.metricKey === "engagement_rate_bp");
    return {
      app,
      creator,
      r,
      isNew: !r || (r.completed === 0 && r.verifiedOutcomes === 0),
      audience,
      engagement: er ? { value: `${(er.valueNumeric / 100).toFixed(1)}%`, source: er.verificationStatus } : null,
      reasons: matchReasons(campaign, creator, accts, r),
      agreement: agreements.find((a) => a.applicationId === app.id && a.version === 1),
      canAct: app.status === "submitted" || app.status === "shortlisted",
      offerOpen: sp.offer === app.id,
    };
  });

  return (
    <>
      <Flash sp={sp} />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter applications">
          {FILTERS.map(([k, l]) => {
            const n = k === "all" ? rows.length : rows.filter((r) => r.app.status === k).length;
            return (
              <Link key={k} href={qs({ filter: k === "all" ? undefined : k })} aria-current={filter === k ? "true" : undefined}
                className={cx("rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors", filter === k ? "border-transparent bg-ink text-white" : "border-line bg-surface text-ink-2 hover:bg-sunken")}>
                {l} <span className={cx("tnum", filter === k ? "text-white/60" : "text-faint")}>{n}</span>
              </Link>
            );
          })}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted"><span className="figures font-semibold text-ink">{hired} of {campaign.creatorSlots}</span> slots offered or filled</span>
          <div role="group" aria-label="Layout" className="inline-flex rounded-full border border-line bg-surface p-0.5 text-[13px] font-semibold">
            <Link href={qs({ view: undefined })} aria-current={mode === "list" ? "true" : undefined} className={cx("rounded-full px-3 py-1", mode === "list" ? "bg-ink text-white" : "text-ink-2 hover:text-ink")}>List</Link>
            <Link href={qs({ view: "compare" })} aria-current={mode === "compare" ? "true" : undefined} className={cx("rounded-full px-3 py-1", mode === "compare" ? "bg-ink text-white" : "text-ink-2 hover:text-ink")}>Compare</Link>
          </div>
        </div>
      </div>

      <p className="mb-5 max-w-3xl text-sm text-muted">
        Match signals are advisory and never hide or reject anyone. A ✓ after a number means it came from the platform&apos;s API or a signed brand event; ○ means the creator reported it.
      </p>

      {cards.length === 0 ? (
        <Card><EmptyState title="No applications in this view" body="Share the campaign or invite creators from Discover creators." action={<Link className="text-sm font-semibold text-stamp" href="/brand/creators">Discover creators</Link>} /></Card>
      ) : mode === "compare" ? (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="sticky left-0 z-10 w-40 bg-surface px-5 py-4 text-left text-[12.5px] font-semibold text-muted">Applicant</th>
                {cards.map((c) => (
                  <th key={c.app.id} scope="col" className="min-w-[180px] px-4 py-4 text-left align-top font-normal">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={c.creator.displayName} color={c.creator.accent} size={32} />
                      <div className="min-w-0">
                        <Link href={`/creators/${c.creator.id}`} className="block truncate font-semibold text-ink hover:text-stamp">{c.creator.displayName}</Link>
                        <div className="truncate text-xs text-muted">{c.creator.location.split(",")[0]}</div>
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line-2">
              <CompareRow label="Status" cells={cards.map((c) => <StatusChip key={c.app.id} status={c.app.status} />)} />
              <CompareRow label="Asks" cells={cards.map((c) => <Money key={c.app.id} minor={c.app.proposedRateMinor} className="text-[17px] font-bold" />)} />
              <CompareRow label="Track record" cells={cards.map((c) => c.isNew ? <span key={c.app.id} className="text-muted">First collaboration</span> : <span key={c.app.id} className="figures">{c.r!.completed} done, {pct(c.r!.onTimeRate)} on time</span>)} />
              <CompareRow label="Verified outcomes" cells={cards.map((c) => <span key={c.app.id} className="figures">{(c.r?.verifiedOutcomes ?? 0).toLocaleString("en-IN")}</span>)} />
              <CompareRow label="Brand rating" cells={cards.map((c) => <span key={c.app.id} className="figures">{c.r?.avgRating ? `${c.r.avgRating.toFixed(1)} / 5` : "—"}</span>)} />
              <CompareRow label="Audience" cells={cards.map((c) => (
                <ul key={c.app.id} className="space-y-0.5">
                  {c.audience.map((a) => <li key={a.id} className="flex items-baseline gap-1.5"><span className="text-muted">{a.platform}</span><span className="figures font-semibold">{a.value}</span><SourceMark status={a.source} /></li>)}
                </ul>
              ))} />
              <CompareRow label="Engagement" cells={cards.map((c) => c.engagement ? <span key={c.app.id} className="flex items-baseline gap-1.5"><span className="figures font-semibold">{c.engagement.value}</span><SourceMark status={c.engagement.source} /></span> : <span key={c.app.id} className="text-faint">—</span>)} />
              <CompareRow label="Fit" cells={cards.map((c) => (
                <ul key={c.app.id} className="space-y-0.5 text-xs">
                  {c.reasons.map((x) => <li key={x.label} className={x.positive ? "text-ink-2" : "text-faint"}>{x.positive ? "✓" : "–"} {x.label}</li>)}
                </ul>
              ))} />
              <CompareRow label="" cells={cards.map((c) => <PrimaryAction key={c.app.id} c={c} qs={qs} back={back} compact />)} />
            </tbody>
          </table>
        </Card>
      ) : (
        <div className="space-y-4">
          {cards.map((c) => (
            <Card key={c.app.id} id={`app-${c.app.id}`} className="overflow-hidden">
              <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_220px] lg:gap-8">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <Avatar name={c.creator.displayName} color={c.creator.accent} size={40} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/creators/${c.creator.id}`} className="text-[16px] font-semibold text-ink hover:text-stamp">{c.creator.displayName}</Link>
                        <StatusChip status={c.app.status} />
                      </div>
                      <div className="text-xs text-muted">
                        {c.creator.location}
                        {c.creator.verificationState === "verified" ? <span className="text-good"> — ID verified ✓</span> : <span> — ID {c.creator.verificationState}</span>}
                      </div>
                    </div>
                  </div>

                  <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
                    <div>
                      <dt className="eyebrow">Track record on proovd</dt>
                      <dd className="mt-0.5 text-sm text-ink">
                        {c.isNew ? (
                          <span className="text-muted">First collaboration. No history yet, which isn&apos;t a negative signal.</span>
                        ) : (
                          <span className="figures">
                            {c.r!.completed} completed, {pct(c.r!.onTimeRate)} on time, {c.r!.verifiedOutcomes.toLocaleString("en-IN")} verified outcomes{c.r!.avgRating ? `, rated ${c.r!.avgRating.toFixed(1)}/5` : ""}
                          </span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="eyebrow">Audience</dt>
                      <dd className="mt-0.5 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                        {c.audience.map((a) => (
                          <span key={a.id} className="inline-flex items-baseline gap-1.5"><span className="text-muted">{a.platform}</span><span className="figures font-semibold">{a.value}</span><SourceMark status={a.source} /></span>
                        ))}
                        {c.engagement && <span className="inline-flex items-baseline gap-1.5"><span className="text-muted">Engagement</span><span className="figures font-semibold">{c.engagement.value}</span><SourceMark status={c.engagement.source} /></span>}
                      </dd>
                    </div>
                  </dl>

                  <blockquote className="mt-4 border-l-2 border-stamp-line pl-3.5 text-[15px] leading-relaxed text-ink-2">{c.app.pitch}</blockquote>
                  <p className="mt-3 text-xs leading-relaxed text-muted">
                    {c.reasons.map((x, i) => (
                      <span key={x.label} className={x.positive ? "text-ink-2" : "text-faint"}>{i > 0 && <span className="text-line">{"  /  "}</span>}{x.positive ? "✓ " : "– "}{x.label}</span>
                    ))}
                  </p>
                  {c.app.brandNote && <p className="mt-2 text-xs text-muted">Your note: {c.app.brandNote}</p>}
                </div>

                <div className="flex flex-col gap-3 border-t border-line-2 pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                  <div>
                    <div className="eyebrow">Asks</div>
                    <Money minor={c.app.proposedRateMinor} className="text-[26px] font-bold leading-tight text-ink" />
                    <div className="text-xs text-muted">{c.app.availability || "Availability not stated"}</div>
                  </div>
                  <PrimaryAction c={c} qs={qs} back={back} />
                </div>
              </div>
              {c.canAct && c.offerOpen && (
                <div id={`offer-${c.app.id}`} className="border-t border-line bg-sunken px-5 py-5 sm:px-6">
                  <h3 className="text-[15px] font-semibold text-ink">Offer to {c.creator.displayName.split(" ")[0]}</h3>
                  <p className="mt-0.5 text-xs text-muted">Starts from the campaign&apos;s terms. Your acceptance is recorded now and becomes binding when the creator accepts.</p>
                  <form action={offerAction} className="mt-4 space-y-4">
                    <input type="hidden" name="applicationId" value={c.app.id} />
                    <input type="hidden" name="back" value={back} />
                    <FormulaFields initial={campaign.compensation} target={campaign.measurement.target} compact />
                    <label className="block space-y-1.5">
                      <span className="block text-sm font-medium text-ink-2">Note to creator (optional)</span>
                      <input name="note" className={inputClass} placeholder="e.g. Base adjusted for a single Reel" />
                    </label>
                    <div className="flex items-center gap-3">
                      <SubmitButton variant="success" pendingLabel="Sending…">Send offer</SubmitButton>
                      <Link href={`${back}#app-${c.app.id}`} className={buttonClass("ghost", "md")}>Cancel</Link>
                    </div>
                  </form>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

type CardData = {
  app: { id: string; status: string };
  creator: { displayName: string };
  agreement?: { id: string };
  canAct: boolean;
  offerOpen: boolean;
};

/**
 * One action slot per applicant, always in the same place. The primary action follows the
 * hiring stage; Decline is always secondary and asks for confirmation.
 */
function PrimaryAction({ c, qs, back, compact = false }: { c: CardData; qs: (o: Record<string, string | undefined>) => string; back: string; compact?: boolean }) {
  if (c.agreement) {
    return <Link href={`/collaborations/${c.agreement.id}`} className={cx(buttonClass("secondary", "sm"), !compact && "w-full")}>Open agreement</Link>;
  }
  if (!c.canAct) return compact ? <span className="text-xs text-faint">No action</span> : null;
  const first = c.creator.displayName.split(" ")[0];
  return (
    <div className={cx("flex gap-2", compact ? "flex-wrap" : "flex-col")}>
      <Link href={`${qs({ view: undefined, offer: c.app.id })}#offer-${c.app.id}`} aria-expanded={c.offerOpen} className={cx(buttonClass("primary", "sm"), !compact && "w-full")}>
        Make offer{compact ? "" : ` to ${first}`}
      </Link>
      <div className={cx("flex gap-2", !compact && "justify-between")}>
        {c.app.status === "submitted" && (
          <form action={applicationStatusAction}>
            <input type="hidden" name="applicationId" value={c.app.id} />
            <input type="hidden" name="to" value="shortlisted" />
            <input type="hidden" name="back" value={back} />
            <SubmitButton size="sm" variant="secondary">Shortlist</SubmitButton>
          </form>
        )}
        <form action={applicationStatusAction}>
          <input type="hidden" name="applicationId" value={c.app.id} />
          <input type="hidden" name="to" value="rejected" />
          <input type="hidden" name="back" value={back} />
          <SubmitButton size="sm" variant="ghost" confirm={`Decline ${c.creator.displayName}? They'll be notified politely.`}>Decline</SubmitButton>
        </form>
      </div>
    </div>
  );
}

function CompareRow({ label, cells }: { label: string; cells: React.ReactNode[] }) {
  return (
    <tr>
      <th scope="row" className="sticky left-0 z-10 bg-surface px-5 py-3 text-left align-top text-[13px] font-medium text-muted">{label}</th>
      {cells.map((cell, i) => (
        <td key={i} className="px-4 py-3 align-top">{cell}</td>
      ))}
    </tr>
  );
}
