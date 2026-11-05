import { getDb } from "@/db";
import { Card, PageHeader, fmtDateTime } from "@/components/ui";
import { auditTrail } from "@/server/admin";
import { requireActor } from "@/server/session";

export const metadata = { title: "Audit trail" };

export default async function Audit() {
  const actor = await requireActor("admin");
  const rows = await auditTrail(await getDb(), actor, 150);
  return (
    <>
      <PageHeader title="Audit trail" description="Append-only at the database level. The latest 150 events." />
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead><tr className="border-b border-line text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-muted"><th className="px-6 py-4 font-medium">When</th><th className="px-3 py-3 font-medium">Actor</th><th className="px-3 py-3 font-medium">Action</th><th className="px-3 py-3 font-medium">Entity</th><th className="px-6 py-4 font-medium">Reason / details</th></tr></thead>
            <tbody className="divide-y divide-line-2">
              {rows.map(({ event: e, actorName }) => (
                <tr key={e.id} className="align-top">
                  <td className="whitespace-nowrap px-6 py-3 text-xs text-muted">{fmtDateTime(e.createdAt)}</td>
                  <td className="px-3 py-2.5">{actorName ?? "system"}</td>
                  <td className="px-3 py-2.5 font-medium">{e.action.replace(/_/g, " ")}</td>
                  <td className="px-3 py-2.5 text-xs text-muted">{e.entityType} <span className="font-mono">{e.entityId.slice(0, 8)}</span></td>
                  <td className="max-w-[340px] px-6 py-3 text-xs text-muted">{e.reason ? <span className="text-ink">“{e.reason}” </span> : null}{Object.keys(e.payload).length ? JSON.stringify(e.payload).slice(0, 160) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
