import Link from "next/link";
import { getDb } from "@/db";
import { eventValidityAction, resetDemo, verificationAction } from "@/app/actions";
import { SubmitButton } from "@/components/client";
import { Avatar, Card, CardHeader, Flash, Money, PageHeader, StatusChip, fmtDateTime, inputClass, relDays } from "@/components/ui";
import { adminQueue } from "@/server/admin";
import { requireActor } from "@/server/session";

export const metadata = { title: "Trust & safety" };

export default async function AdminQueue({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const actor = await requireActor("admin");
  const sp = await searchParams;
  const q = await adminQueue(await getDb(), actor);
  return (
    <>
      <Flash sp={sp} />
      <PageHeader title="Trust & safety queue" description="Human review for anything uncertain. Every override records an actor and a reason." eyebrow={<Link href="/admin" className="hover:text-ink">← Overview</Link>} />

      <Card id="disputes" className="scroll-mt-24">
        <CardHeader title="Disputes" />
        {q.openDisputes.length === 0 ? <p className="px-6 py-8 text-sm text-muted">No open disputes.</p> : (
          <ul className="divide-y divide-line-2">
            {q.openDisputes.map(({ dispute: d, campaign, creator, opener }) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 px-6 py-5">
                <Avatar name={creator.displayName} color={creator.accent} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium capitalize">{d.category.replace(/_/g, " ")} <span className="font-normal normal-case text-muted">· {campaign.title} · {creator.displayName}</span></div>
                  <div className="line-clamp-1 text-sm text-muted">{d.description}</div>
                  <div className="text-xs text-muted">Opened by {opener.name} {relDays(d.createdAt)} · hold <Money minor={d.amountHeldMinor} /></div>
                </div>
                <StatusChip status={d.state} />
                <Link href={`/admin/disputes/${d.id}`} className="inline-flex h-9 items-center rounded-full bg-ink px-4 text-[13px] font-semibold text-white">Review</Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <Card id="events" className="scroll-mt-24">
          <CardHeader title="Excluded attribution events" description="Restore if the exclusion was wrong. Reason required." />
          <ul className="max-h-[420px] divide-y divide-line-2 overflow-auto">
            {q.invalidEvents.map(({ event: e, campaign, creator }) => (
              <li key={e.id} className="px-6 py-4 text-sm">
                <div className="flex items-center justify-between gap-2"><span className="font-mono text-xs">{e.eventId}</span><StatusChip status={e.validityState} /></div>
                <div className="text-xs text-muted">{campaign.title} · {creator.displayName} · {e.reasonCode?.replace(/_/g, " ") ?? "—"}</div>
                {e.validityState === "invalid" && (
                  <form action={eventValidityAction} className="mt-2 flex gap-2">
                    <input type="hidden" name="eventId" value={e.id} />
                    <input type="hidden" name="to" value="valid" />
                    <input type="hidden" name="back" value="/admin/queue" />
                    <input name="reason" aria-label="Reason" placeholder="Reason to restore" className={`${inputClass} h-8 py-1`} />
                    <SubmitButton size="sm" variant="secondary">Restore</SubmitButton>
                  </form>
                )}
              </li>
            ))}
            {q.invalidEvents.length === 0 && <li className="px-6 py-8 text-sm text-muted">Nothing excluded.</li>}
          </ul>
        </Card>
        <div className="space-y-8">
          <Card id="verification" className="scroll-mt-24">
            <CardHeader title="Verification requests" />
            <ul className="divide-y divide-line-2">
              {[...q.pendingCreators.map((c) => ({ kind: "creator" as const, id: c.id, name: c.displayName, sub: c.headline })), ...q.pendingOrgs.map((o) => ({ kind: "organization" as const, id: o.id, name: o.displayName, sub: o.legalName }))].map((x) => (
                <li key={x.id} className="px-6 py-4 text-sm">
                  <div className="font-medium">{x.name} <span className="font-normal text-muted">· {x.kind === "creator" ? "Creator ID" : "Business KYB"}</span></div>
                  <div className="text-xs text-muted">{x.sub}</div>
                  <form action={verificationAction} className="mt-2 flex flex-wrap gap-2">
                    <input type="hidden" name="kind" value={x.kind} />
                    <input type="hidden" name="id" value={x.id} />
                    <input type="hidden" name="back" value="/admin/queue" />
                    <input name="reason" aria-label="Reason" defaultValue="Documents checked" className={`${inputClass} h-8 w-48 py-1`} />
                    <SubmitButton name="to" value="verified" size="sm" variant="success">Verify</SubmitButton>
                    <SubmitButton name="to" value="rejected" size="sm" variant="danger">Reject</SubmitButton>
                  </form>
                </li>
              ))}
              {q.pendingCreators.length + q.pendingOrgs.length === 0 && <li className="px-6 py-8 text-sm text-muted">No pending requests.</li>}
            </ul>
          </Card>
          <Card id="payments" className="scroll-mt-24">
            <CardHeader title="Payment exceptions" />
            <ul className="divide-y divide-line-2">
              {q.failedTransfers.map((t) => (
                <li key={t.id} className="flex items-center justify-between px-6 py-4 text-sm"><span><Money minor={t.amountMinor} /> · <span className="font-mono text-xs">{t.providerRef}</span></span><StatusChip status={t.state} /></li>
              ))}
              {q.failedTransfers.length === 0 && <li className="px-6 py-8 text-sm text-muted">No failed transfers. Paid transfers can be reversed from the dispute view.</li>}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Demo data" />
            <form action={resetDemo} className="px-6 py-5">
              <input type="hidden" name="back" value="/admin/queue" />
              <SubmitButton size="sm" variant="danger" confirm="Reset all demo data?">Reset demo data</SubmitButton>
            </form>
          </Card>
        </div>
      </div>
      <p className="mt-8 text-xs text-muted">Last refreshed {fmtDateTime(new Date())}.</p>
    </>
  );
}
