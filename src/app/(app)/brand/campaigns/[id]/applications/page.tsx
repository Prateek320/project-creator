import Link from "next/link";
import { inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { applicationStatusAction, offerAction } from "@/app/actions";
import { SubmitButton } from "@/components/client";
import { FormulaFields } from "@/components/formula";
import { Avatar, Badge, Card, EmptyState, Flash, Money, ProvenanceChip, StatusChip, inputClass, pct } from "@/components/ui";
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
  const shown = filter === "all" ? rows : rows.filter((r) => r.app.status === filter);
  const back = `/brand/campaigns/${campaign.id}/applications${filter !== "all" ? `?filter=${filter}` : ""}`;
  const hired = rows.filter((r) => r.app.status === "accepted" || r.app.status === "offered").length;

  return (
    <>
      <Flash sp={sp} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter applications">
          {FILTERS.map(([k, l]) => {
            const n = k === "all" ? rows.length : rows.filter((r) => r.app.status === k).length;
            return (
              <Link key={k} href={`/brand/campaigns/${campaign.id}/applications${k === "all" ? "" : `?filter=${k}`}`} aria-current={filter === k ? "true" : undefined}
                className={`rounded-full border px-3 py-1 text-sm ${filter === k ? "border-accent bg-accent-50 text-accent-600" : "border-line bg-white text-ink-2 hover:bg-slate-50"}`}>
                {l} <span className="tnum text-muted">{n}</span>
              </Link>
            );
          })}
        </div>
        <div className="text-sm text-muted">{hired} of {campaign.creatorSlots} slots offered or filled</div>
      </div>

      <p className="mb-4 text-sm text-muted">
        Match signals are advisory and explain themselves — they never hide or reject anyone. Compare on track record and audience evidence, not follower count alone.
      </p>

      {shown.length === 0 ? (
        <Card><EmptyState title="No applications in this view" body="Share the campaign or invite creators from Discover creators." action={<Link className="text-sm font-medium text-accent" href="/brand/creators">Discover creators →</Link>} /></Card>
      ) : (
        <div className="space-y-4">
          {shown.map(({ app, creator }) => {
            const r = rep.get(creator.id);
            const ms = metrics.get(creator.id) ?? [];
            const followers = ms.filter((m: typeof schema.metricSnapshots.$inferSelect) => m.metricKey === "followers" || m.metricKey === "subscribers");
            const er = ms.find((m: typeof schema.metricSnapshots.$inferSelect) => m.metricKey === "engagement_rate_bp");
            const accts = accounts.filter((a) => a.creatorProfileId === creator.id);
            const reasons = matchReasons(campaign, creator, accts, r);
            const ag = agreements.find((a) => a.applicationId === app.id && a.version === 1);
            const canAct = app.status === "submitted" || app.status === "shortlisted";
            return (
              <Card key={app.id} className="overflow-hidden">
                <div className="grid gap-5 p-5 lg:grid-cols-[260px_1fr_220px]">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <Avatar name={creator.displayName} color={creator.accent} size={44} />
                      <div className="min-w-0">
                        <Link href={`/creators/${creator.id}`} className="font-semibold hover:text-accent">{creator.displayName}</Link>
                        <div className="truncate text-xs text-muted">{creator.location}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <StatusChip status={app.status} />
                      {creator.verificationState === "verified" ? <Badge tone="good">ID verified</Badge> : <Badge>ID {creator.verificationState}</Badge>}
                    </div>
                    <dl className="mt-4 space-y-2 text-sm">
                      {followers.map((m: typeof schema.metricSnapshots.$inferSelect) => (
                        <div key={m.id} className="flex items-center justify-between gap-2">
                          <dt className="text-muted">{accts.find((a) => a.id === m.socialAccountId)?.platform ?? "Audience"}</dt>
                          <dd className="flex items-center gap-2"><span className="tnum font-medium">{formatCompact(m.valueNumeric)}</span><ProvenanceChip status={m.verificationStatus} observedAt={m.observedAt} /></dd>
                        </div>
                      ))}
                      {er && (
                        <div className="flex items-center justify-between gap-2">
                          <dt className="text-muted">Engagement</dt>
                          <dd className="flex items-center gap-2"><span className="tnum font-medium">{(er.valueNumeric / 100).toFixed(1)}%</span><ProvenanceChip status={er.verificationStatus} observedAt={er.observedAt} /></dd>
                        </div>
                      )}
                    </dl>
                  </div>

                  <div className="min-w-0">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <Metric label="Completed" value={r?.completed ?? 0} />
                      <Metric label="On-time" value={pct(r?.onTimeRate ?? null)} />
                      <Metric label="Verified outcomes" value={(r?.verifiedOutcomes ?? 0).toLocaleString("en-IN")} />
                      <Metric label="Brand rating" value={r?.avgRating ? `${r.avgRating.toFixed(1)} / 5` : "—"} />
                    </div>
                    <blockquote className="mt-4 border-l-2 border-line pl-3 text-sm leading-relaxed text-ink-2">{app.pitch}</blockquote>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {reasons.map((x) => (
                        <span key={x.label} className={`rounded-md px-2 py-0.5 text-xs ${x.positive ? "bg-good-50 text-good" : "bg-slate-100 text-muted"}`}>{x.positive ? "✓" : "–"} {x.label}</span>
                      ))}
                    </div>
                    {app.brandNote && <p className="mt-3 text-xs text-muted">Your note: {app.brandNote}</p>}
                  </div>

                  <div className="space-y-3 lg:border-l lg:border-line-2 lg:pl-5">
                    <div>
                      <div className="text-xs text-muted">Asks</div>
                      <div className="tnum text-xl font-semibold"><Money minor={app.proposedRateMinor} /></div>
                      <div className="text-xs text-muted">{app.availability || "Availability not stated"}</div>
                    </div>
                    {canAct && (
                      <div className="flex flex-wrap gap-2">
                        {app.status === "submitted" && (
                          <form action={applicationStatusAction}>
                            <input type="hidden" name="applicationId" value={app.id} />
                            <input type="hidden" name="to" value="shortlisted" />
                            <input type="hidden" name="back" value={back} />
                            <SubmitButton size="sm" variant="secondary">Shortlist</SubmitButton>
                          </form>
                        )}
                        <form action={applicationStatusAction} className="flex gap-2">
                          <input type="hidden" name="applicationId" value={app.id} />
                          <input type="hidden" name="to" value="rejected" />
                          <input type="hidden" name="back" value={back} />
                          <SubmitButton size="sm" variant="ghost" confirm={`Decline ${creator.displayName}? They'll be notified politely.`}>Decline</SubmitButton>
                        </form>
                      </div>
                    )}
                    {ag && <Link href={`/collaborations/${ag.id}`} className="inline-block text-sm font-medium text-accent">Open agreement →</Link>}
                  </div>
                </div>
                {canAct && (
                  <details className="border-t border-line-2 bg-slate-50/50">
                    <summary className="px-5 py-3 text-sm font-medium text-accent">Send offer to {creator.displayName.split(" ")[0]} →</summary>
                    <form action={offerAction} className="space-y-4 px-5 pb-5">
                      <input type="hidden" name="applicationId" value={app.id} />
                      <input type="hidden" name="back" value={back} />
                      <FormulaFields initial={campaign.compensation} target={campaign.measurement.target} compact />
                      <label className="block space-y-1.5">
                        <span className="block text-sm font-medium text-ink-2">Note to creator (optional)</span>
                        <input name="note" className={inputClass} placeholder="e.g. Base adjusted for a single Reel" />
                      </label>
                      <div className="flex items-center gap-3">
                        <SubmitButton pendingLabel="Sending…">Send offer</SubmitButton>
                        <span className="text-xs text-muted">Your acceptance is recorded now; it becomes binding when the creator accepts.</span>
                      </div>
                    </form>
                  </details>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className="tnum mt-0.5 text-[15px] font-semibold">{value}</div>
    </div>
  );
}
