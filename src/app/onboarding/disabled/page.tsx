import { SignOutButton } from "@clerk/nextjs";
import { notFound } from "next/navigation";
import { buttonClass } from "@/components/ui";
import { authMode } from "@/server/env";
import { OnboardingShell } from "../shell";

export const metadata = { title: "Account unavailable" };

export default async function Disabled() {
  if (authMode() !== "clerk") notFound();
  return (
    <OnboardingShell title="This account is unavailable" lead="It has been suspended or closed. Contact support if you think this is a mistake." sp={{}}>
      <SignOutButton redirectUrl="/"><button className={buttonClass("secondary")}>Sign out</button></SignOutButton>
    </OnboardingShell>
  );
}
