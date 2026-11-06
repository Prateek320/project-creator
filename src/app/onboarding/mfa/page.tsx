import { SignOutButton, UserProfile } from "@clerk/nextjs";
import { notFound, redirect } from "next/navigation";
import { Notice, buttonClass } from "@/components/ui";
import { authMode } from "@/server/env";
import { continueUrl, identityState } from "@/server/session";
import { OnboardingShell } from "../shell";

export const metadata = { title: "Two-step verification" };
export const dynamic = "force-dynamic";

export default async function Mfa({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (authMode() !== "clerk") notFound();
  const s = await identityState();
  if (s?.kind !== "mfa_required") redirect(continueUrl(s));
  const sp = await searchParams;
  return (
    <OnboardingShell
      title="Turn on two-step verification"
      lead={s.actor.role === "admin" ? "Platform operations accounts must use two-step verification." : "Brand owners control billing and payouts, so two-step verification is required."}
      sp={sp}
    >
      <Notice title="Two steps">
        1. Add an authenticator app under <strong>Security</strong> below. 2. Sign out and sign in again, entering your code. Your session then counts as verified.
      </Notice>
      <div className="mt-6"><UserProfile routing="hash" /></div>
      <div className="mt-6">
        <SignOutButton redirectUrl="/sign-in"><button className={buttonClass("primary")}>Sign out and sign in again</button></SignOutButton>
      </div>
    </OnboardingShell>
  );
}
