import Link from "next/link";
import { BadgeCheck, HandCoins, MousePointerClick, Target } from "lucide-react";
import { getDb } from "@/db";
import { csvImportAction, eventValidityAction } from "@/app/actions";
import { BarChart } from "@/components/charts";
import { SubmitButton } from "@/components/client";
import { Avatar, Card, CardBody, CardHeader, EmptyState, Flash, Money, ProvenanceChip, Stat, StatusChip, fmtDateTime, inputClass, pct } from "@/components/ui";
import { formatCompact, formatINR } from "@/domain/money";
import { campaignReport } from "@/server/finance";
import { requireActor } from "@/server/session";

export const metadata = { title: "Results & attribution" };

const METRIC_LABEL: Record<string, string> = { views: "Reel views", reach: "Reel reach", saves: "Saves", story_reach: "Story reach", link_sticker_taps: "Link sticker taps" };

export default async function Analytics({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const actor = await requireActor("brand");
  const { id } = await params;
  const sp = await searchParams;
  const db = await getDb();
  const r = await campaignReport(db, actor, id);
  const back = `/brand/campaigns/${id}/analytics`;
  const valid = r.perCreator.reduce((s, p) => s + p.settlement.validOutcomes, 0);
  const clicks = r.perCreator.reduce((s, p) => s + p.clicks, 0);
  const committed = r.balances.creator_payable + r.balances.creator_paid + r.balances.dispute_hold;
  const earned = r.perCreator.reduce((s, p) => s + p.settlement.totalMinor, 0);
  const outcomeEvents = r.events.filter((e) => e.eventType !== "click").slice(-40).reverse();

  return (
    <>
      <Flash sp={sp} />
      <div className="tiles grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat icon={BadgeCheck} label={`Verified ${r.outcomeType}s`} value={valid.toLocaleString("en-IN")} hint={`Target ${r.campaign.measurement.target} per creator`} />
        <Stat icon={MousePointerClick} label="Tracked clicks" value={formatCompact(clicks)} hint={clicks ? `${pct(valid / clicks, 1)} click → ${r.outcomeType}` : "No clicks yet"} />
        <Stat icon={HandCoins} label="Earned by creators" value={formatINR(earned)} hint={`${formatINR(committed)} approved so far`} />
        <Stat icon={Target} label={`Cost per ${r.outcomeType}`} value={valid ? formatINR(Math.round(earned / valid / 100) * 100) : "—"} hint={r.attributionCoverage === null ? "Attribution coverage —" : `Attribution coverage ${pct(r.attributionCoverage)}`} />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader title={`Verified ${r.outcomeType}s per day`} description="Valid events only — duplicates, test and excluded events are not counted." />
          <CardBody><BarChart data={r.series} label={`Verified ${r.outcomeType}s per day`} height={220} /></CardBody>
        </Card>
        <Card>
          <CardHeader title="Content metrics" description="Every number shows where it came from." />
          {r.metrics.length === 0 ? (
            <p className="px-6 py-8 text-sm text-muted">No content metrics yet. They appear when creators connect accounts or upload insights.</p>
          ) : (
            <ul className="divide-y divide-line-2">
              {r.metrics.map(({ m, creator }) => (
                <li key={m.id} className="flex items-center justify-between gap-3 px-6 py-3 text-sm">
                  <div className="min-w-0">
                    <div className="truncate">{METRIC_LABEL[m.metricKey] ?? m.metricKey}</div>
                    <div className="truncate text-xs text-muted" title={m.source}>{creator.displayName} · {m.source}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="tnum font-medium">{m.verificationStatus === "unavailable" ? "—" : formatCompact(m.valueNumeric)}</span>
                    <ProvenanceChip status={m.verificationStatus} observedAt={m.observedAt} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-8">
        <CardHeader title="By creator" description="Settlement is computed from each creator's accepted agreement version." />
        {r.perCreator.length === 0 ? (
          <EmptyState title="No active creators yet" body="Results appear once a creator accepts an agreement." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead><tr className="border-b border-line text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-muted">
                <th className="px-6 py-4 font-medium">Creator</th><th className="px-3 py-3 text-right font-medium">Clicks</th><th className="px-3 py-3 text-right font-medium">Valid</th><th className="px-3 py-3 text-right font-medium">Excluded</th><th className="px-3 py-3 text-right font-medium">Deliverables</th><th className="px-3 py-3 text-right font-medium">Earned</th><th className="px-6 py-4 text-right font-medium">Paid</th>
              </tr></thead>
              <tbody className="divide-y divide-line-2">
                {r.perCreator.map((p) => {
                  const ex = p.settlement.excluded;
                  return (
                    <tr key={p.rootId} className="transition-colors hover:bg-white/60">
                      <td className="px-6 py-4"><Link href={`/collaborations/${p.rootId}/settlement`} className="flex items-center gap-2 font-medium hover:text-accent"><Avatar name={p.creator.displayName} color={p.creator.accent} size={26} />{p.creator.displayName}</Link><div className="pl-8 text-xs text-muted">code {p.coupon}</div></td>
                      <td className="tnum px-3 py-3 text-right">{p.clicks.toLocaleString("en-IN")}</td>
                      <td className="tnum px-3 py-3 text-right font-medium">{p.settlement.validOutcomes}</td>
                      <td className="tnum px-3 py-3 text-right text-muted">{ex.duplicate + ex.invalid + ex.outOfWindow + ex.test}</td>
                      <td className="tnum px-3 py-3 text-right">{p.settlement.deliverablesApproved}/{p.settlement.deliverablesTotal}</td>
                      <td className="px-3 py-3 text-right"><Money minor={p.settlement.totalMinor} /></td>
                      <td className="px-6 py-4 text-right"><Money minor={p.paid} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader title="Recent outcome events" description="Exclude an event if it fails your agreed definition. Every override needs a reason and is audited." />
          {outcomeEvents.length === 0 ? (
            <p className="px-6 py-8 text-sm text-muted">No events yet. Send them via the signed webhook or upload a CSV.</p>
          ) : (
            <div className="max-h-[480px] overflow-auto">
              <table className="w-full min-w-[620px] text-sm">
                <thead className="sticky top-0 bg-white/90 backdrop-blur"><tr className="border-b border-line text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-muted"><th className="px-6 py-2.5 font-medium">Event ID</th><th className="px-3 py-2 font-medium">Time</th><th className="px-3 py-2 font-medium">Source</th><th className="px-3 py-2 font-medium">Status</th><th className="px-6 py-2.5" /></tr></thead>
                <tbody className="divide-y divide-line-2">
                  {outcomeEvents.map((e) => (
                    <tr key={e.id}>
                      <td className="px-6 py-2.5 font-mono text-xs">{e.eventId}</td>
                      <td className="px-3 py-2 text-xs text-muted">{fmtDateTime(e.occurredAt)}</td>
                      <td className="px-3 py-2 text-xs text-muted">{e.source.replace(/_/g, " ")}</td>
                      <td className="px-3 py-2"><StatusChip status={e.validityState} /></td>
                      <td className="px-6 py-2.5 text-right">
                        {(e.validityState === "valid" || e.validityState === "invalid") && (
                          <details className="relative inline-block text-left">
                            <summary className="text-xs font-medium text-accent">{e.validityState === "valid" ? "Exclude" : "Restore"}</summary>
                            <form action={eventValidityAction} className="absolute right-0 z-10 mt-1 w-64 space-y-2 rounded-2xl border border-line bg-white p-3 shadow-[var(--shadow-pop)]">
                              <input type="hidden" name="eventId" value={e.id} />
                              <input type="hidden" name="to" value={e.validityState === "valid" ? "invalid" : "valid"} />
                              <input type="hidden" name="back" value={back} />
                              <input name="reason" required minLength={5} placeholder="Reason (audited)" className={inputClass} />
                              <SubmitButton size="sm" variant={e.validityState === "valid" ? "danger" : "secondary"}>{e.validityState === "valid" ? "Exclude event" : "Restore event"}</SubmitButton>
                            </form>
                          </details>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Import conversions" description="CSV with a header row. Re-uploading the same event_id is ignored." />
          <CardBody>
            <form action={csvImportAction} className="space-y-3">
              <input type="hidden" name="campaignId" value={id} />
              <input type="hidden" name="back" value={back} />
              <input type="file" name="file" accept=".csv,text/csv" aria-label="CSV file" className="block w-full text-sm file:mr-3 file:rounded-lg file:border file:border-line file:bg-white file:px-3 file:py-1.5 file:text-sm" />
              <details>
                <summary className="text-xs font-medium text-accent">…or paste CSV</summary>
                <textarea name="csv" rows={4} className={`${inputClass} mt-2 font-mono text-xs`} placeholder={`event_id,creator_id,event_type,occurred_at\nord-1001,${r.perCreator[0]?.creator.id ?? "<creator id>"},${r.outcomeType},${new Date().toISOString().slice(0, 16)}`} />
              </details>
              <SubmitButton size="sm" pendingLabel="Importing…">Import</SubmitButton>
            </form>
            <div className="mt-4 rounded-lg bg-sunken p-3 text-xs text-muted">
              Columns: <code>event_id</code>, <code>creator_id</code>, <code>event_type</code>, <code>occurred_at</code>, optional <code>value_minor</code>, <code>test</code>. For real-time events use the{" "}
              <Link href="/brand/settings#webhook" className="font-medium text-accent">signed webhook</Link>.
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
