import Link from "next/link";
import { getDb } from "@/db";
import { markReadAction } from "@/app/actions";
import { SubmitButton } from "@/components/client";
import { Card, EmptyState, Flash, PageHeader, fmtDateTime } from "@/components/ui";
import { listNotifications } from "@/server/admin";
import { requireActor } from "@/server/session";

export const metadata = { title: "Notifications" };

export default async function Notifications({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const actor = await requireActor();
  const { rows, unread } = await listNotifications(await getDb(), actor);
  const sp = await searchParams;
  return (
    <>
      <Flash sp={sp} />
      <PageHeader title="Notifications" description="In-app for now; email delivery plugs into the notification provider." actions={unread > 0 ? <form action={markReadAction}><input type="hidden" name="back" value="/notifications" /><SubmitButton variant="secondary" size="sm">Mark all read</SubmitButton></form> : undefined} />
      <Card>
        {rows.length === 0 ? <EmptyState title="Nothing yet" body="Offers, approvals, payouts and disputes show up here." /> : (
          <ul className="divide-y divide-line-2">
            {rows.map((n) => (
              <li key={n.id}>
                <Link href={n.href ?? "#"} className="flex items-start gap-3 px-6 py-4 transition-colors hover:bg-white/60">
                  <span aria-hidden className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.readAt ? "bg-transparent" : "bg-accent"}`} />
                  <div className="min-w-0 flex-1"><div className="text-sm font-medium">{n.title}{!n.readAt && <span className="sr-only"> (unread)</span>}</div><div className="truncate text-sm text-muted">{n.body}</div></div>
                  <span className="shrink-0 text-xs text-muted">{fmtDateTime(n.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
