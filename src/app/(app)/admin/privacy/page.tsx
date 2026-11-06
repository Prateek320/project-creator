import { getDb } from "@/db";
import { Badge, Card, EmptyState, PageHeader, fmtDateTime } from "@/components/ui";
import { openDataRequests } from "@/server/privacy";
import { requireActor } from "@/server/session";
import { ShieldCheck } from "lucide-react";

export const metadata = { title: "Privacy requests" };

export default async function PrivacyRequests() {
  const actor = await requireActor("admin");
  const rows = await openDataRequests(await getDb(), actor);
  const now = Date.now();
  return (
    <>
      <PageHeader title="Privacy requests" description="Data exports and account deletions not yet completed. The law allows 90 days; jobs normally finish in minutes, so anything here for long needs a look." />
      {rows.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="Nothing open" body="Every export and deletion request has been completed." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr className="border-b border-line text-left text-[12.5px] font-semibold text-muted"><th className="px-6 py-4 font-medium">Requested</th><th className="px-3 py-3 font-medium">Person</th><th className="px-3 py-3 font-medium">Kind</th><th className="px-3 py-3 font-medium">Status</th><th className="px-6 py-4 font-medium">Due</th></tr></thead>
              <tbody className="divide-y divide-line-2">
                {rows.map(({ r, name, email }) => (
                  <tr key={r.id} className="align-top">
                    <td className="whitespace-nowrap px-6 py-3 text-xs text-muted">{fmtDateTime(r.createdAt)}</td>
                    <td className="px-3 py-2.5"><div className="font-medium">{name}</div><div className="text-xs text-muted">{email}</div></td>
                    <td className="px-3 py-2.5">{r.kind === "export" ? "Export" : "Deletion"}</td>
                    <td className="px-3 py-2.5"><Badge tone={r.status === "blocked" ? "warn" : "neutral"}>{r.status === "blocked" ? "On hold" : "Queued"}</Badge>{r.reason && <p className="mt-1 max-w-[280px] text-xs text-muted">{r.reason}</p>}</td>
                    <td className={`whitespace-nowrap px-6 py-3 text-xs ${r.dueAt.getTime() - now < 14 * 86_400_000 ? "font-semibold text-bad" : "text-muted"}`}>{fmtDateTime(r.dueAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
