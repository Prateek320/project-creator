import { OrganizationList } from "@clerk/nextjs";
import { notFound, redirect } from "next/navigation";
import { Card, CardBody, Field, Notice, buttonClass, inputClass } from "@/components/ui";
import { authMode } from "@/server/env";
import { OWNER_ROLE } from "@/server/identity";
import { continueUrl, identityState, sessionClaims } from "@/server/session";
import { setupBrandAction } from "../actions";
import { OnboardingShell } from "../shell";

export const metadata = { title: "Set up your brand" };
export const dynamic = "force-dynamic";

const CATEGORIES = ["D2C", "Beauty", "Fashion", "Food & beverage", "Consumer tech", "Fintech", "Travel", "Agency", "Other"];

export default async function BrandSetup({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (authMode() !== "clerk") notFound();
  const s = await identityState();
  if (s?.kind !== "brand_setup") redirect(continueUrl(s));
  const sp = await searchParams;
  const claims = await sessionClaims();

  if (!claims?.orgId) {
    return (
      <OnboardingShell title="Your team" lead="Create a team for your brand, or pick one you've been invited to. Teammates you invite share campaigns and billing." sp={sp}>
        <OrganizationList hidePersonal afterCreateOrganizationUrl="/onboarding/brand" afterSelectOrganizationUrl="/onboarding/brand" />
      </OnboardingShell>
    );
  }

  if (claims.orgRole !== OWNER_ROLE) {
    return (
      <OnboardingShell title="Almost there" lead="Your team owner hasn't finished setting up the brand yet." sp={sp}>
        <Notice title="Waiting for the owner">Ask the person who invited you to sign in and complete the brand details. Or switch to another team:</Notice>
        <div className="mt-6"><OrganizationList hidePersonal afterSelectOrganizationUrl="/onboarding/brand" /></div>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell title="Set up your brand" lead="Creators see these details on your campaigns. Business verification comes later." sp={sp}>
      <Card>
        <CardBody>
          <form action={setupBrandAction} className="space-y-5">
            <Field label="Legal name" htmlFor="legal_name" hint="As registered, e.g. on your GST certificate.">
              <input id="legal_name" name="legal_name" required maxLength={200} className={inputClass} />
            </Field>
            <Field label="Display name" htmlFor="display_name" hint="What creators see. Defaults to the legal name.">
              <input id="display_name" name="display_name" maxLength={120} className={inputClass} />
            </Field>
            <Field label="Category" htmlFor="category">
              <select id="category" name="category" className={inputClass} defaultValue="D2C">
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Website" htmlFor="website">
              <input id="website" name="website" type="url" placeholder="https://" maxLength={300} className={inputClass} />
            </Field>
            <button className={buttonClass("primary")}>Create brand</button>
          </form>
        </CardBody>
      </Card>
    </OnboardingShell>
  );
}
