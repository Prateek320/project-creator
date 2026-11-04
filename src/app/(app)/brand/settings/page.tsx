import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { resetDemo } from "@/app/actions";
import { CopyButton, SubmitButton } from "@/components/client";
import { Avatar, Badge, Card, CardBody, CardHeader, DL, Flash, PageHeader, StatusChip } from "@/components/ui";
import { signPayload } from "@/domain/attribution";
import { requireActor } from "@/server/session";

export const metadata = { title: "Team & settings" };

export default async function Settings({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const actor = await requireActor("brand");
  const sp = await searchParams;
  const db = await getDb();
  const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, actor.orgId!));
  const team = await db.select({ m: schema.memberships, u: schema.users }).from(schema.memberships).innerJoin(schema.users, eq(schema.memberships.userId, schema.users.id)).where(eq(schema.memberships.organizationId, org!.id));
  const [sample] = await db
    .select({ a: schema.agreements, c: schema.campaigns })
    .from(schema.agreements)
    .innerJoin(schema.campaigns, eq(schema.agreements.campaignId, schema.campaigns.id))
    .where(eq(schema.campaigns.organizationId, org!.id))
    .limit(1);
  const body = JSON.stringify({
    event_id: "order-10001",
    campaign_id: sample?.c.id ?? "<campaign id>",
    creator_id: sample?.a.creatorProfileId ?? "<creator id>",
    event_type: sample?.c.compensation.outcomeEvent ?? "signup",
    occurred_at: new Date().toISOString().slice(0, 19) + "Z",
    value_minor: 0,
  });
  const sig = signPayload(org!.webhookSecret, body);
  const curl = `curl -X POST "$APP_URL/api/v1/attribution/events" \\\n  -H "content-type: application/json" \\\n  -H "x-pc-org: ${org!.id}" \\\n  -H "x-pc-signature: sha256=${sig}" \\\n  -d '${body}'`;

  return (
    <>
      <Flash sp={sp} />
      <PageHeader title="Team & settings" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Organisation" actions={<StatusChip status={org!.verificationState} label={org!.verificationState === "verified" ? "Business verified" : undefined} />} />
          <CardBody><DL items={[["Display name", org!.displayName], ["Legal name", org!.legalName], ["Category", org!.category], ["Website", org!.website ?? "—"]]} /></CardBody>
        </Card>
        <Card>
          <CardHeader title="Team" description="Role-based access is enforced on the server for every action." />
          <ul className="divide-y divide-line-2">
            {team.map(({ m, u }) => (
              <li key={m.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                <Avatar name={u.name} size={30} />
                <div className="flex-1"><div className="font-medium">{u.name}</div><div className="text-xs text-muted">{u.email}</div></div>
                <Badge dot={false}>{m.role}</Badge>
              </li>
            ))}
          </ul>
          <p className="border-t border-line-2 px-5 py-3 text-xs text-muted">Inviting teammates arrives with managed authentication (MFA required for owners).</p>
        </Card>
        <Card className="lg:col-span-2" id="webhook">
          <CardHeader title="Conversion webhook" description="Send signups, leads or orders from your backend. Signed with HMAC-SHA256; replays of the same event_id are counted once." />
          <CardBody className="space-y-4 text-sm">
            <DL items={[["Endpoint", <code key="e">POST /api/v1/attribution/events</code>], ["Organisation ID", <code key="o" className="break-all">{org!.id}</code>]]} />
            <details>
              <summary className="font-medium text-accent">Reveal signing secret</summary>
              <div className="mt-2 flex flex-wrap items-center gap-2"><code className="break-all rounded bg-slate-100 px-2 py-1 text-xs">{org!.webhookSecret}</code><CopyButton value={org!.webhookSecret} /></div>
              <p className="mt-1 text-xs text-muted">Demo only: in production this lives in a secrets manager, is shown once, and can be rotated.</p>
            </details>
            <div>
              <div className="mb-1 flex items-center justify-between"><span className="font-medium">Try it — a correctly signed request</span><CopyButton value={curl} label="Copy curl" /></div>
              <pre className="overflow-x-auto rounded-xl bg-ink p-4 text-xs leading-relaxed text-slate-100">{curl}</pre>
            </div>
          </CardBody>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Demo data" description="Restore every account, campaign and ledger entry to the seeded starting state." />
          <CardBody>
            <form action={resetDemo}>
              <input type="hidden" name="back" value="/brand/settings" />
              <SubmitButton variant="danger" size="sm" confirm="Reset all demo data for everyone using this instance?">Reset demo data</SubmitButton>
            </form>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
