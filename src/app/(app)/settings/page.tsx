import Link from "next/link";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui";
import { ThemeToggle } from "@/components/theme";
import { requireActor } from "@/server/session";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const actor = await requireActor();
  return (
    <>
      <PageHeader title="Settings" description="Personal preferences for this browser." />
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
      </div>
    </>
  );
}
