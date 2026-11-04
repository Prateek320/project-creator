import Link from "next/link";
import { getDb } from "@/db";
import { addAccountAction, addPortfolioAction, disconnectAction, updateProfileAction } from "@/app/actions";
import { SubmitButton } from "@/components/client";
import { Card, CardBody, CardHeader, Field, Flash, PageHeader, ProvenanceChip, StatusChip, inputClass } from "@/components/ui";
import { formatCompact } from "@/domain/money";
import { AUDIENCE_BANDS, CHANNELS, NICHES, getCreatorProfile } from "@/server/creators";
import { requireActor } from "@/server/session";

export const metadata = { title: "Profile & portfolio" };

export default async function EditProfile({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const actor = await requireActor("creator");
  const sp = await searchParams;
  const { profile: p, accounts, metrics, portfolio } = await getCreatorProfile(await getDb(), actor, actor.creatorProfileId!);
  const back = "/creator/profile";
  return (
    <>
      <Flash sp={sp} />
      <PageHeader title="Profile & portfolio" description="You control what brands see. Numbers you add yourself are labelled as creator-reported." actions={<Link href={`/creators/${p.id}`} className="text-sm font-medium text-accent">Preview public profile →</Link>} />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader title="Profile" actions={<StatusChip status={p.verificationState} label={p.verificationState === "verified" ? "ID verified" : undefined} />} />
          <CardBody>
            <form action={updateProfileAction} className="space-y-4">
              <input type="hidden" name="back" value={back} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Display name" htmlFor="displayName"><input id="displayName" name="displayName" defaultValue={p.displayName} className={inputClass} /></Field>
                <Field label="Location" htmlFor="location"><input id="location" name="location" defaultValue={p.location} className={inputClass} /></Field>
              </div>
              <Field label="Headline" htmlFor="headline"><input id="headline" name="headline" defaultValue={p.headline} className={inputClass} /></Field>
              <Field label="Bio" htmlFor="bio"><textarea id="bio" name="bio" rows={3} defaultValue={p.bio} className={inputClass} /></Field>
              <fieldset>
                <legend className="mb-2 text-sm font-medium text-ink-2">Niches (first is primary)</legend>
                <div className="flex flex-wrap gap-2">
                  {NICHES.map((n) => (
                    <label key={n} className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent-50">
                      <input type="checkbox" name="niches" value={n} defaultChecked={p.niches.includes(n)} /> {n}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Languages" htmlFor="languages" hint="Comma-separated"><input id="languages" name="languages" defaultValue={p.languages.join(", ")} className={inputClass} /></Field>
                <Field label="Audience size" htmlFor="audienceBand"><select id="audienceBand" name="audienceBand" defaultValue={p.audienceBand} className={inputClass}>{AUDIENCE_BANDS.map((b) => <option key={b}>{b}</option>)}</select></Field>
                <Field label="Rate from (₹)" htmlFor="rateMin"><input id="rateMin" name="rateMin" inputMode="decimal" defaultValue={String(p.rateMinMinor / 100)} className={inputClass} /></Field>
                <Field label="Rate up to (₹)" htmlFor="rateMax"><input id="rateMax" name="rateMax" inputMode="decimal" defaultValue={String(p.rateMaxMinor / 100)} className={inputClass} /></Field>
                <Field label="Availability" htmlFor="availability"><select id="availability" name="availability" defaultValue={p.availability} className={inputClass}><option value="available">Available for new work</option><option value="busy">Busy</option></select></Field>
                <Field label="Profile visibility" htmlFor="visibility" hint="Private profiles are only shown to brands you apply to."><select id="visibility" name="visibility" defaultValue={p.visibility} className={inputClass}><option value="public">Public — discoverable by brands</option><option value="private">Private</option></select></Field>
              </div>
              <SubmitButton pendingLabel="Saving…">Save profile</SubmitButton>
            </form>
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Connected accounts" description="Official OAuth connections arrive after platform app review. Until then, add evidence manually." />
            <ul className="divide-y divide-line-2">
              {accounts.map((a) => (
                <li key={a.id} className="px-5 py-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div><div className="font-medium">{a.platform} · @{a.handle}</div><div className="text-xs text-muted">{a.connectionState === "connected_api" ? `API connected · scopes: ${a.scopes.join(", ")}` : a.connectionState === "manual_evidence" ? "Manual evidence" : "Disconnected — data marked stale"}</div></div>
                    {a.connectionState !== "disconnected" && (
                      <form action={disconnectAction}>
                        <input type="hidden" name="accountId" value={a.id} />
                        <input type="hidden" name="back" value={back} />
                        <SubmitButton size="sm" variant="ghost" confirm={`Disconnect ${a.platform}? Access is revoked and its numbers are marked stale.`}>Disconnect</SubmitButton>
                      </form>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {metrics.filter((m) => m.socialAccountId === a.id).map((m) => (
                      <span key={m.id} className="inline-flex items-center gap-1.5 text-xs"><span className="tnum font-medium">{m.metricKey === "engagement_rate_bp" ? `${(m.valueNumeric / 100).toFixed(1)}%` : formatCompact(m.valueNumeric)}</span><span className="text-muted">{m.metricKey.replace(/_bp$/, "").replace(/_/g, " ")}</span><ProvenanceChip status={m.verificationStatus} observedAt={m.observedAt} /></span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
            <details className="border-t border-line-2">
              <summary className="px-5 py-3 text-sm font-medium text-accent">+ Add account with evidence</summary>
              <form action={addAccountAction} className="space-y-3 px-5 pb-5">
                <input type="hidden" name="back" value={back} />
                <div className="grid grid-cols-2 gap-3">
                  <select name="platform" aria-label="Platform" className={inputClass}>{CHANNELS.map((c) => <option key={c}>{c}</option>)}</select>
                  <input name="handle" aria-label="Handle" placeholder="@handle" className={inputClass} />
                  <input name="followers" aria-label="Followers" inputMode="numeric" placeholder="Followers" className={inputClass} />
                  <input name="engagementRate" aria-label="Engagement rate %" inputMode="decimal" placeholder="Engagement %" className={inputClass} />
                </div>
                <input name="evidenceUrl" aria-label="Evidence link" placeholder="https:// link to insights screenshot or export" className={inputClass} />
                <SubmitButton size="sm">Add account</SubmitButton>
              </form>
            </details>
          </Card>
          <Card>
            <CardHeader title="Portfolio" />
            <ul className="divide-y divide-line-2">
              {portfolio.map((it) => (
                <li key={it.id} className="px-5 py-3 text-sm"><a href={it.url} target="_blank" rel="noopener noreferrer" className="font-medium hover:text-accent">{it.title} ↗</a><div className="text-xs text-muted">{it.platform}{it.brandName ? ` · ${it.brandName}` : ""}{it.resultSummary ? ` · ${it.resultSummary}` : ""}</div></li>
              ))}
              {portfolio.length === 0 && <li className="px-5 py-4 text-sm text-muted">Add your best work so brands can judge fit.</li>}
            </ul>
            <details className="border-t border-line-2">
              <summary className="px-5 py-3 text-sm font-medium text-accent">+ Add work</summary>
              <form action={addPortfolioAction} className="space-y-3 px-5 pb-5">
                <input type="hidden" name="back" value={back} />
                <input name="title" aria-label="Title" placeholder="Title" className={inputClass} />
                <input name="url" aria-label="Link" placeholder="https://" className={inputClass} />
                <div className="grid grid-cols-2 gap-3">
                  <select name="platform" aria-label="Platform" className={inputClass}>{CHANNELS.map((c) => <option key={c}>{c}</option>)}</select>
                  <input name="brandName" aria-label="Brand" placeholder="Brand (optional)" className={inputClass} />
                </div>
                <input name="resultSummary" aria-label="Results" placeholder="Results, e.g. 120K views · 900 saves" className={inputClass} />
                <SubmitButton size="sm">Add</SubmitButton>
              </form>
            </details>
          </Card>
        </div>
      </div>
    </>
  );
}
