import Link from "next/link";
import { getDb } from "@/db";
import { ButtonLink, Card, EmptyState, PageHeader, StatusChip, fmtDate } from "@/components/ui";
import { describeFormula } from "@/domain/compensation";
import { listCreatorCollaborations } from "@/server/collaborations";
import { requireActor } from "@/server/session";

export const metadata = { title: "Collaborations" };

export default async function MyCollaborations() {
  const actor = await requireActor("creator");
  const rows = await listCreatorCollaborations(await getDb(), actor);
  return (
    <>
      <PageHeader title="Collaborations" description="Offers, active work and completed campaigns." />
      <Card>
        {rows.length === 0 ? <EmptyState title="No collaborations yet" body="When a brand sends you an offer it appears here." action={<ButtonLink href="/creator/campaigns">Discover campaigns</ButtonLink>} /> : (
          <ul className="divide-y divide-line-2">
            {rows.map(({ agreement, campaign, status }) => (
              <li key={agreement.id}>
                <Link href={`/collaborations/${agreement.id}`} className="flex flex-wrap items-center gap-3 px-5 py-4 hover:bg-slate-50">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{campaign.title}</div>
                    <div className="text-sm text-muted">{describeFormula(agreement.formulaSnapshot)}</div>
                    <div className="text-xs text-muted">{fmtDate(campaign.startAt)} – {fmtDate(campaign.endAt)}</div>
                  </div>
                  <StatusChip status={status ?? agreement.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
