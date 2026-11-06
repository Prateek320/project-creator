import { ArrowRight } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { Card, buttonClass } from "@/components/ui";
import { authMode } from "@/server/env";
import { continueUrl, identityState, sessionClaims } from "@/server/session";
import { onboardAction } from "./actions";
import { OnboardingShell } from "./shell";

export const metadata = { title: "Welcome" };
export const dynamic = "force-dynamic";

export default async function Onboarding({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (authMode() !== "clerk") notFound();
  const s = await identityState();
  if (s?.kind !== "onboarding") redirect(continueUrl(s));
  const sp = await searchParams;
  const invited = Boolean((await sessionClaims())?.orgId);

  if (invited) {
    return (
      <OnboardingShell title="Join your team" lead="You were invited to a brand team on proovd." sp={sp}>
        <form action={onboardAction}>
          <input type="hidden" name="choice" value="brand" />
          <button className={buttonClass("primary")}>Continue to your team <ArrowRight size={14} aria-hidden /></button>
        </form>
      </OnboardingShell>
    );
  }

  const options = [
    { choice: "brand", title: "I'm a brand or agency", body: "Publish campaigns, hire creators on evidence and pay for verified results. You'll set up your team next." },
    { choice: "creator", title: "I'm a creator", body: "See the payout formula before you apply and build a track record you own." },
  ];
  return (
    <OnboardingShell title="Welcome to proovd" lead="How will you use proovd? This sets up your workspace and can't be changed later." sp={sp}>
      <Card className="divide-y divide-line-2">
        {options.map((o) => (
          <form key={o.choice} action={onboardAction} className="flex items-center gap-4 px-6 py-5">
            <input type="hidden" name="choice" value={o.choice} />
            <div className="min-w-0 flex-1">
              <div className="font-medium">{o.title}</div>
              <div className="mt-0.5 text-sm text-muted">{o.body}</div>
            </div>
            <button className={buttonClass("secondary", "sm")}>Continue <ArrowRight size={14} aria-hidden /></button>
          </form>
        ))}
      </Card>
    </OnboardingShell>
  );
}
