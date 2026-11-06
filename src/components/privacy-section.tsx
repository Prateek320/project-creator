import { Download } from "lucide-react";
import Link from "next/link";
import { getDb } from "@/db";
import { requestErasureAction, requestExportAction, setProductEmailsAction } from "@/app/actions";
import { SubmitButton } from "@/components/client";
import { Badge, Card, CardBody, CardHeader, fmtDateTime, inputClass } from "@/components/ui";
import type { Actor } from "@/server/core";
import { currentConsents, listMyRequests } from "@/server/privacy";

const STATUS: Record<string, string> = { queued: "In progress", completed: "Done", blocked: "On hold", cancelled: "Cancelled" };

export async function PrivacySection({ actor, back }: { actor: Actor; back: string }) {
  const db = await getDb();
  const [consents, requests] = await Promise.all([currentConsents(db, actor.userId), listMyRequests(db, actor)]);
  const emails = consents.product_emails?.granted ?? false;
  return (
    <Card id="privacy">
      <CardHeader title="Privacy" description={<>Your data under the <Link href="/privacy" className="font-semibold text-accent">privacy notice</Link>. Requests are handled within 90 days, usually minutes.</>} />
      <CardBody className="space-y-6">
        <form action={setProductEmailsAction} className="flex items-center justify-between gap-4">
          <input type="hidden" name="back" value={`${back}#privacy`} />
          <input type="hidden" name="granted" value={emails ? "off" : "on"} />
          <div className="text-sm">
            <div className="font-medium">Product news emails</div>
            <div className="text-muted">{emails ? "On" : "Off"}. Emails about your account activity are always sent.</div>
          </div>
          <SubmitButton variant="secondary" size="sm">{emails ? "Turn off" : "Turn on"}</SubmitButton>
        </form>

        <form action={requestExportAction} className="flex items-center justify-between gap-4">
          <input type="hidden" name="back" value={`${back}#privacy`} />
          <div className="text-sm">
            <div className="font-medium">Download your data</div>
            <div className="text-muted">A JSON file of your profile, activity and consents, available for 7 days.</div>
          </div>
          <SubmitButton variant="secondary" size="sm" pendingLabel="Requesting…">Request export</SubmitButton>
        </form>

        {requests.length > 0 && (
          <ul className="divide-y divide-line-2 rounded-lg border border-line-2 text-sm">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="font-medium">{r.kind === "export" ? "Data export" : "Account deletion"}</span>
                <Badge dot={false}>{STATUS[r.status] ?? r.status}</Badge>
                <span className="text-xs text-muted">{fmtDateTime(r.createdAt)}</span>
                {r.kind === "export" && r.status === "completed" && r.hasResult && (
                  <a className="ml-auto inline-flex items-center gap-1.5 font-semibold text-accent" href={`/api/privacy/export/${r.id}`}><Download size={14} aria-hidden />Download</a>
                )}
                {r.reason && <p className="w-full text-xs text-muted">{r.reason}</p>}
              </li>
            ))}
          </ul>
        )}

        <details className="rounded-lg border border-bad/25 px-4 py-3">
          <summary className="cursor-pointer text-sm font-semibold text-bad">Delete my account</summary>
          <form action={requestErasureAction} className="mt-4 space-y-3 text-sm">
            <input type="hidden" name="back" value={`${back}#privacy`} />
            <p className="text-muted">This signs you out everywhere and removes your name, email, profile and portfolio. Agreements, settlements and payouts stay on record under an anonymous id, as accounting law requires. It can&apos;t be undone.</p>
            <label className="block">
              <span className="font-medium">Type <strong>{actor.email}</strong> to confirm</span>
              <input name="confirm_email" autoComplete="off" required className={`${inputClass} mt-2`} />
            </label>
            <SubmitButton variant="danger" size="sm" pendingLabel="Requesting…">Delete my account</SubmitButton>
          </form>
        </details>
      </CardBody>
    </Card>
  );
}
