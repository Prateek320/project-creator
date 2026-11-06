import Link from "next/link";
import { Card, CardBody, CardHeader, Flash, PageHeader } from "@/components/ui";
import { ThemeToggle } from "@/components/theme";
import { requireActor } from "@/server/session";
import { PrivacySection } from "@/components/privacy-section";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  return (
    <>
      <Flash sp={sp} />
      <PageHeader title="Settings" description="Your preferences, email and privacy." />
      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader title="Appearance" description="Light keeps the proovd colours. Dark is a quiet monochrome theme. System follows your device." />
          <CardBody>
            <ThemeToggle />
            <p className="mt-4 text-xs leading-relaxed text-muted">Animations are kept subtle and turn off automatically when your device asks for reduced motion.</p>
          </CardBody>
        </Card>
        {actor.role === "brand" && (
          <Card>
            <CardHeader title="Team, billing and webhooks" description="Organisation settings live in Team & settings." />
            <CardBody>
              <Link href="/brand/settings" className="text-sm font-semibold text-accent">Open Team &amp; settings →</Link>
            </CardBody>
          </Card>
        )}
        <PrivacySection actor={actor} back="/settings" />
      </div>
    </>
  );
}
