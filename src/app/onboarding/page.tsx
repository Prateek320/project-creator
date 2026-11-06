import { ArrowRight } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Card, buttonClass, cx } from "@/components/ui";
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

  const consent = (
    <div className="mt-6 space-y-3 text-sm">
      <label className="flex items-start gap-3">
        <input type="checkbox" name="accept_notice" required className="mt-1" />
        <span>I have read the <Link href="/privacy" target="_blank" className="font-semibold text-accent">privacy notice</Link> and agree to proovd processing my data to run my account.</span>
      </label>
      <label className="flex items-start gap-3">
        <input type="checkbox" name="product_emails" className="mt-1" />
        <span className="text-muted">Send me occasional product news and tips (optional; change any time in Settings).</span>
      </label>
    </div>
  );

  if (invited) {
    return (
      <OnboardingShell title="Join your team" lead="You were invited to a brand team on proovd." sp={sp}>
        <form action={onboardAction}>
          <input type="hidden" name="choice" value="brand" />
          {consent}
          <button className={cx(buttonClass("primary"), "mt-6")}>Continue to your team <ArrowRight size={14} aria-hidden /></button>
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
      <form action={onboardAction}>
        <fieldset>
          <legend className="sr-only">Account type</legend>
          <Card className="divide-y divide-line-2">
            {options.map((o, i) => (
              <label key={o.choice} className="flex cursor-pointer items-center gap-4 px-6 py-5">
                <input type="radio" name="choice" value={o.choice} defaultChecked={i === 0} required />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{o.title}</div>
                  <div className="mt-0.5 text-sm text-muted">{o.body}</div>
                </div>
              </label>
            ))}
          </Card>
        </fieldset>
        {consent}
        <button className={cx(buttonClass("primary"), "mt-6")}>Continue <ArrowRight size={14} aria-hidden /></button>
      </form>
    </OnboardingShell>
  );
}
