import Link from "next/link";
import { getDb } from "@/db";
import { campaignTransitionAction, fundCampaignAction, refundAction } from "@/app/actions";
import { SubmitButton } from "@/components/client";
import { EarningsPreview } from "@/components/formula";
import { Avatar, Card, CardBody, CardHeader, DL, Flash, Money, Notice, StatusChip, fmtDate } from "@/components/ui";
import { describeFormula } from "@/domain/compensation";
import { balances } from "@/domain/ledger";
import { getRequirements } from "@/server/campaigns";
import { listCampaignCollaborations } from "@/server/collaborations";
import { getOwnedCampaign, ledgerFor } from "@/server/core";
import { requireActor } from "@/server/session";

export default async function CampaignOverview({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const actor = await requireActor("brand");
  const { id } = await params;
  const sp = await searchParams;
  const db = await getDb();
  const c = await getOwnedCampaign(db, actor, id);
  const [reqs, collabs, ledger] = await Promise.all([getRequirements(db, c.id), listCampaignCollaborations(db, actor, c.id), ledgerFor(db, { campaignId: c.id })]);
  const b = balances(ledger);
  const back = `/brand/campaigns/${c.id}`;
  const transition = (to: string, label: string, variant: "primary" | "secondary" | "danger" = "secondary", confirm?: string) => (
    <form action={campaignTransitionAction}>
      <input type="hidden" name="campaignId" value={c.id} />
      <input type="hidden" name="to" value={to} />
      <input type="hidden" name="back" value={back} />
      <SubmitButton variant={variant} size="sm" confirm={confirm}>{label}</SubmitButton>
    </form>
  );

  return (
    <>
      <Flash sp={sp} />
      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-8">
          <Card>
            <CardHeader title="Brief" description={`${c.objective} · ${c.niche} · ${c.channels.join(", ")}`} />
            <CardBody><p className="whitespace-pre-line text-[15px] leading-relaxed text-ink-2">{c.brief}</p></CardBody>
          </Card>
          <Card>
            <CardHeader title="Deliverables per creator" description="Due dates count from the campaign start." />
            <ul className="divide-y divide-line-2">
              {reqs.map((r) => (
                <li key={r.id} className="flex flex-wrap items-start justify-between gap-2 px-6 py-4 text-sm">
                  <div>
                    <div className="font-medium">{r.quantity} × {r.deliverableType} <span className="font-normal text-muted">on {r.channel}</span></div>
                    {r.acceptanceCriteria && <div className="text-xs text-muted">{r.acceptanceCriteria}</div>}
                  </div>
                  <div className="text-xs text-muted">due day {r.dueOffsetDays} · {fmtDate(new Date(c.startAt.getTime() + r.dueOffsetDays * 86_400_000))}</div>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Measurement & terms" />
            <CardBody>
              <DL
                items={[
                  ["Primary metric", `${c.measurement.primaryMetric} · target ${c.measurement.target} per creator`],
                  ["Source of truth", c.measurement.sourceOfTruth.replace(/_/g, " ")],
                  ["Valid outcome", c.measurement.validDefinition || <span className="text-warn">Not defined yet</span>],
                  ["Excluded", c.compensation.exclusions || "—"],
                  ["Usage rights", c.rights || <span className="text-warn">Not defined yet</span>],
                  ["Audience", `${c.audience.locations.join(", ")} · ${c.audience.ageRange} · ${c.audience.languages.join(", ")}`],
                  ["Dates", `${fmtDate(c.startAt, { day: "numeric", month: "short", year: "numeric" })} – ${fmtDate(c.endAt, { day: "numeric", month: "short", year: "numeric" })}`],
                  ["Applications close", c.applyBy ? fmtDate(c.applyBy) : "When slots are filled"],
                ]}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Creators on this campaign" actions={<Link href={`${back}/applications`} className="text-sm font-medium text-accent">Applications →</Link>} />
            {collabs.length === 0 ? (
              <p className="px-6 py-8 text-sm text-muted">No offers yet. Shortlist applicants and send an offer to get started.</p>
            ) : (
              <ul className="divide-y divide-line-2">
                {collabs.map(({ agreement, creator, status }) => (
                  <li key={agreement.id}>
                    <Link href={`/collaborations/${agreement.id}`} className="flex items-center gap-3 px-6 py-4 transition-colors hover:bg-white/60">
                      <Avatar name={creator.displayName} color={creator.accent} size={32} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{creator.displayName}</div>
                        <div className="text-xs text-muted">{describeFormula(agreement.formulaSnapshot)}</div>
                      </div>
                      <StatusChip status={status ?? agreement.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-8">
          <Card>
            <CardHeader title="Budget" actions={c.status !== "draft" ? <StatusChip status={c.fundingState} /> : undefined} />
            <CardBody className="space-y-3 text-sm">
              <div className="tnum text-2xl font-semibold"><Money minor={c.budgetMinor} /></div>
              <dl className="space-y-1.5">
                <div className="flex justify-between"><dt className="text-muted">Held at provider</dt><dd><Money minor={b.campaign_funds} /></dd></div>
                <div className="flex justify-between"><dt className="text-muted">Approved, unpaid</dt><dd><Money minor={b.creator_payable} /></dd></div>
                <div className="flex justify-between"><dt className="text-muted">Held for disputes</dt><dd><Money minor={b.dispute_hold} /></dd></div>
                <div className="flex justify-between"><dt className="text-muted">Paid to creators</dt><dd><Money minor={b.creator_paid} /></dd></div>
                {b.brand_refund > 0 && <div className="flex justify-between"><dt className="text-muted">Refunded</dt><dd><Money minor={b.brand_refund} /></dd></div>}
              </dl>
              {c.fundingState === "not_funded" && c.status !== "draft" && c.status !== "cancelled" && (
                <form action={fundCampaignAction} className="pt-1">
                  <input type="hidden" name="campaignId" value={c.id} />
                  <input type="hidden" name="back" value={back} />
                  <SubmitButton className="w-full" pendingLabel="Funding…">Fund campaign (test payment)</SubmitButton>
                  <p className="mt-2 text-xs text-muted">Funds are collected by the payment provider, not held by proovd. Mock provider in this build.</p>
                </form>
              )}
              {(c.status === "completed" || c.status === "cancelled") && b.campaign_funds > 0 && (
                <form action={refundAction}>
                  <input type="hidden" name="campaignId" value={c.id} />
                  <input type="hidden" name="back" value={back} />
                  <SubmitButton variant="secondary" className="w-full">Refund unspent <Money minor={b.campaign_funds} /></SubmitButton>
                </form>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Payout formula" description="Snapshotted into each agreement" />
            <CardBody>
              <p className="mb-3 text-sm text-ink-2">{describeFormula(c.compensation)}</p>
              <EarningsPreview formula={c.compensation} target={c.measurement.target} budgetMinor={c.budgetMinor} slots={c.creatorSlots} title="What a creator could earn" />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Campaign status" />
            <CardBody className="flex flex-wrap gap-2">
              {c.status === "draft" && transition("published", "Publish campaign", "primary")}
              {c.status === "published" && transition("paused", "Pause applications")}
              {c.status === "paused" && transition("published", "Resume", "primary")}
              {(c.status === "published" || c.status === "paused") && transition("completed", "Close campaign", "secondary", "Close this campaign? Open applications will be closed.")}
              {c.status !== "completed" && c.status !== "cancelled" && transition("cancelled", "Cancel", "danger", "Cancel this campaign? This can't be undone.")}
              {(c.status === "completed" || c.status === "cancelled") && <p className="text-sm text-muted">This campaign is closed.</p>}
            </CardBody>
          </Card>
          {c.status === "draft" && <Notice tone="warn">Drafts aren&apos;t visible to creators. Publishing validates every material term and the budget.</Notice>}
        </div>
      </div>
    </>
  );
}
