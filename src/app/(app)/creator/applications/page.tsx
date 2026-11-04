import Link from "next/link";
import { getDb } from "@/db";
import { withdrawAction } from "@/app/actions";
import { SubmitButton } from "@/components/client";
import { ButtonLink, Card, EmptyState, Flash, Money, PageHeader, StatusChip, fmtDate } from "@/components/ui";
import { listCreatorApplications } from "@/server/collaborations";
import { requireActor } from "@/server/session";

export const metadata = { title: "Applications" };
const NEXT: Record<string, string> = {
  submitted: "Waiting for the brand to review",
  shortlisted: "You're on the shortlist — an offer may follow",
  offered: "You have an offer — review and accept it in Collaborations",
  accepted: "Hired — see the collaboration workspace",
  rejected: "The brand went another way this time",
  withdrawn: "You withdrew",
  expired: "The campaign closed",
};

export default async function MyApplications({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const actor = await requireActor("creator");
  const rows = await listCreatorApplications(await getDb(), actor);
  const sp = await searchParams;
  return (
    <>
      <Flash sp={sp} />
      <PageHeader title="Applications" description="Every application shows where it stands and what happens next." />
      <Card>
        {rows.length === 0 ? <EmptyState title="No applications yet" body="Find a campaign that fits your audience and apply in a couple of minutes." action={<ButtonLink href="/creator/campaigns">Discover campaigns</ButtonLink>} /> : (
          <ul className="divide-y divide-line-2">
            {rows.map(({ app, campaign }) => (
              <li key={app.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <Link href={`/creator/campaigns/${campaign.id}`} className="font-medium hover:text-accent">{campaign.title}</Link>
                  <div className="text-sm text-muted">{NEXT[app.status]}</div>
                  <div className="text-xs text-muted">Applied {fmtDate(app.createdAt)} · asked <Money minor={app.proposedRateMinor} /></div>
                </div>
                <StatusChip status={app.status} />
                {app.status === "offered" && <ButtonLink size="sm" href="/creator/collaborations">Review offer</ButtonLink>}
                {(app.status === "submitted" || app.status === "shortlisted") && (
                  <form action={withdrawAction}>
                    <input type="hidden" name="applicationId" value={app.id} />
                    <input type="hidden" name="back" value="/creator/applications" />
                    <SubmitButton size="sm" variant="ghost" confirm="Withdraw this application?">Withdraw</SubmitButton>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
