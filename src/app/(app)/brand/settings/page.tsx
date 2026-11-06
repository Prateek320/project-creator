import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { resetDemo } from "@/app/actions";
import { authMode, isDemo } from "@/server/env";
import { OrganizationProfile } from "@clerk/nextjs";
import { PrivacySection } from "@/components/privacy-section";
import { CopyButton, RotateSecret, SubmitButton } from "@/components/client";
import { ThemeToggle } from "@/components/theme";
import { Avatar, Badge, Card, CardBody, CardHeader, DL, Flash, PageHeader, StatusChip, fmtDateTime } from "@/components/ui";
import { requireActor } from "@/server/session";

export const metadata = { title: "Team & settings" };

export default async function Settings({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const actor = await requireActor("brand");
  const sp = await searchParams;
  const db = await getDb();
  const clerk = authMode() === "clerk";
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
  // The secret never reaches the page: the example signs with the brand's own copy at run time.
  const curl = [
    `BODY='${body}'`,
    `SIG=$(printf %s "$BODY" | openssl dgst -sha256 -hmac "$PROOVD_WEBHOOK_SECRET" | sed 's/^.* //')`,
    `curl -X POST "$APP_URL/api/v1/attribution/events" \\`,
    `  -H "content-type: application/json" \\`,
    `  -H "x-pc-org: ${org!.id}" \\`,
    `  -H "x-pc-signature: sha256=$SIG" \\`,
    `  -d "$BODY"`,
  ].join("\n");

  return (
    <>
      <Flash sp={sp} />
      <PageHeader title="Team & settings" />
      <div className="grid gap-8 lg:grid-cols-2">
        <Card>
          <CardHeader title="Appearance" description="Light keeps the proovd colours. Dark is a quiet monochrome theme. System follows your device." />
          <CardBody><ThemeToggle /></CardBody>
        </Card>
        <Card>
          <CardHeader title="Organisation" actions={<StatusChip status={org!.verificationState} label={org!.verificationState === "verified" ? "Business verified" : undefined} />} />
          <CardBody><DL items={[["Display name", org!.displayName], ["Legal name", org!.legalName], ["Category", org!.category], ["Website", org!.website ?? "—"]]} /></CardBody>
        </Card>
        <Card>
          <CardHeader title="Team" description="Role-based access is enforced on the server for every action." />
          <ul className="divide-y divide-line-2">
            {team.map(({ m, u }) => (
              <li key={m.id} className="flex items-center gap-3 px-6 py-4 text-sm">
                <Avatar name={u.name} size={30} />
                <div className="flex-1"><div className="font-medium">{u.name}</div><div className="text-xs text-muted">{u.email}</div></div>
                <Badge dot={false}>{m.role}</Badge>
              </li>
            ))}
          </ul>
          {clerk ? (
            <p className="border-t border-line-2 px-6 py-4 text-xs text-muted">Owners invite and remove teammates below. Owners must use two-step verification.</p>
          ) : (
            <p className="border-t border-line-2 px-6 py-4 text-xs text-muted">Inviting teammates needs managed sign-in, which the demo doesn&apos;t use.</p>
          )}
        </Card>
        {clerk && (
          <div className="lg:col-span-2" id="members">
            <OrganizationProfile routing="hash" />
          </div>
        )}
        <div className="lg:col-span-2"><PrivacySection actor={actor} back="/brand/settings" /></div>
        <Card className="lg:col-span-2" id="webhook">
          <CardHeader title="Conversion webhook" description="Send signups, leads or orders from your backend. Signed with HMAC-SHA256; replays of the same event_id are counted once." />
          <CardBody className="space-y-4 text-sm">
            <DL items={[["Endpoint", <code key="e">POST /api/v1/attribution/events</code>], ["Organisation ID", <code key="o" className="break-all">{org!.id}</code>]]} />
            <RotateSecret
              hasSecret={Boolean(org!.webhookSecretEnc)}
              rotatedAt={org!.webhookSecretRotatedAt ? fmtDateTime(org!.webhookSecretRotatedAt) : null}
            />
            <div>
              <div className="mb-1 flex items-center justify-between"><span className="font-medium">Try it: a correctly signed request (set PROOVD_WEBHOOK_SECRET first)</span><CopyButton value={curl} label="Copy curl" /></div>
              <pre className="overflow-x-auto rounded-2xl bg-ink p-4 text-xs leading-relaxed text-slate-100">{curl}</pre>
            </div>
          </CardBody>
        </Card>
        {isDemo() && <Card className="lg:col-span-2">
          <CardHeader title="Demo data" description="Restore every account, campaign and ledger entry to the seeded starting state." />
          <CardBody>
            <form action={resetDemo}>
              <input type="hidden" name="back" value="/brand/settings" />
              <SubmitButton variant="danger" size="sm" confirm="Reset all demo data for everyone using this instance?">Reset demo data</SubmitButton>
            </form>
          </CardBody>
        </Card>}
      </div>
    </>
  );
}
