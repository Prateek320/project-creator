import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { applyAction } from "@/app/actions";
import { SubmitButton } from "@/components/client";
import { EarningsPreview } from "@/components/formula";
import { Avatar, Card, CardBody, CardHeader, DL, Field, Flash, Notice, PageHeader, StatusChip, fmtDate, inputClass } from "@/components/ui";
import { describeFormula } from "@/domain/compensation";
import { formatINR } from "@/domain/money";
import { getCampaignForCreator, getRequirements } from "@/server/campaigns";
import { requireActor } from "@/server/session";

export default async function CampaignBrief({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const actor = await requireActor("creator");
  const { id } = await params;
  const sp = await searchParams;
  const db = await getDb();
  const row = await getCampaignForCreator(db, actor, id).catch(() => null);
  if (!row) notFound();
  const { campaign: c, brand } = row;
  const [reqs, [existing], [me]] = await Promise.all([
    getRequirements(db, c.id),
    db.select().from(schema.applications).where(and(eq(schema.applications.campaignId, c.id), eq(schema.applications.creatorProfileId, actor.creatorProfileId!))),
    db.select().from(schema.creatorProfiles).where(eq(schema.creatorProfiles.id, actor.creatorProfileId!)),
  ]);
  const f = c.compensation;
  const back = `/creator/campaigns/${c.id}`;
  return (
    <>
      <PageHeader
        eyebrow={<Link href="/creator/campaigns" className="hover:text-ink">← Discover campaigns</Link>}
        title={c.title}
        description={<span className="inline-flex items-center gap-2"><Avatar name={brand.displayName} color="#0f172a" size={20} />{brand.displayName} · {brand.category}{brand.verificationState === "verified" ? " · verified business" : ""}</span>}
      />
      <Flash sp={sp} />
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-8">
          <Card>
            <CardHeader title="The brief" />
            <CardBody><p className="whitespace-pre-line text-[15px] leading-relaxed text-ink-2">{c.brief}</p></CardBody>
          </Card>
          <Card>
            <CardHeader title="What you'd deliver" description={`Campaign runs ${fmtDate(c.startAt)} – ${fmtDate(c.endAt, { day: "numeric", month: "short", year: "numeric" })}`} />
            <ul className="divide-y divide-line-2">
              {reqs.map((r) => (
                <li key={r.id} className="px-6 py-4 text-sm">
                  <div className="flex justify-between gap-3"><span className="font-medium">{r.quantity} × {r.deliverableType} on {r.channel}</span><span className="text-muted">due {fmtDate(new Date(c.startAt.getTime() + r.dueOffsetDays * 86_400_000))}</span></div>
                  {r.acceptanceCriteria && <div className="mt-0.5 text-xs text-muted">Accepted when: {r.acceptanceCriteria}</div>}
                </li>
              ))}
            </ul>
            <p className="border-t border-line-2 px-6 py-4 text-xs text-muted">Includes up to 2 revision rounds per deliverable. Further changes need an amendment you accept.</p>
          </Card>
          <Card>
            <CardHeader title="Terms you'd be agreeing to" />
            <CardBody>
              <DL items={[
                ["Usage rights", c.rights],
                ["Paid for", f.model === "fixed" ? "Approved deliverables" : `Verified ${f.outcomeEvent}s${f.model === "hybrid" ? " + approved deliverables" : ""}`],
                ["What counts", c.measurement.validDefinition],
                ["Not counted", f.exclusions || "—"],
                ["Measured by", c.measurement.sourceOfTruth === "brand_webhook" ? "Brand's signed server events + your tracked link and code" : c.measurement.sourceOfTruth === "csv_upload" ? "Brand CSV with event IDs (deduplicated)" : "Your tracked link"],
                ["Attribution window", f.model === "fixed" ? "Not applicable" : `${f.attributionWindowDays} days after the campaign ends`],
              ]} />
            </CardBody>
          </Card>
          {f.model !== "fixed" && (
            <Notice tone="info" title="What's in your control — and what isn't">
              You control the content and getting it approved on time{f.model === "hybrid" ? ", which secures the base fee" : ""}. Conversions also depend on the brand&apos;s pricing, site and stock. If tracking breaks or the brand&apos;s site goes down, you can open a dispute with evidence.
            </Notice>
          )}
        </div>

        <div className="space-y-8 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader title="Payout" description={describeFormula(f)} />
            <CardBody><EarningsPreview formula={f} target={c.measurement.target} title="Estimate your earnings" /></CardBody>
          </Card>
          {existing ? (
            <Card>
              <CardHeader title="Your application" actions={<StatusChip status={existing.status} />} />
              <CardBody className="text-sm">
                <p className="text-muted">You asked for {formatINR(existing.proposedRateMinor)}.</p>
                <Link href="/creator/applications" className="mt-2 inline-block font-medium text-accent">Track in Applications →</Link>
              </CardBody>
            </Card>
          ) : c.status !== "published" ? (
            <Notice tone="warn">This campaign isn&apos;t accepting applications right now.</Notice>
          ) : (
            <Card>
              <CardHeader title="Apply" description="Brands see your pitch alongside your verified track record." />
              <CardBody>
                <form action={applyAction} className="space-y-4">
                  <input type="hidden" name="campaignId" value={c.id} />
                  <input type="hidden" name="back" value={back} />
                  <Field label="Your pitch" htmlFor="pitch" hint="Why you, the angle you'd take, and your audience fit (30+ characters)."><textarea id="pitch" name="pitch" rows={5} required minLength={30} className={inputClass} /></Field>
                  <Field label="Your rate (₹)" htmlFor="rate" hint={f.model === "fixed" ? `Listed fee: ${formatINR(f.fixedFeeMinor ?? 0)}` : `Your usual range: ${formatINR(me?.rateMinMinor ?? 0)}–${formatINR(me?.rateMaxMinor ?? 0)}`}>
                    <input id="rate" name="rate" inputMode="decimal" required defaultValue={String(((f.fixedFeeMinor ?? f.baseFeeMinor ?? me?.rateMinMinor ?? 0) / 100))} className={inputClass} />
                  </Field>
                  <Field label="Availability" htmlFor="availability"><input id="availability" name="availability" defaultValue="Can start on the campaign start date" className={inputClass} /></Field>
                  <Field label="Relevant work (optional)" htmlFor="links" hint="Comma-separated https links"><input id="links" name="links" className={inputClass} /></Field>
                  <SubmitButton className="w-full" pendingLabel="Sending…">Send application</SubmitButton>
                </form>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
