"use server";

/**
 * Onboarding for Clerk sign-ins: create the proovd user, then (for brand owners) the brand organisation.
 * Only reachable in clerk auth mode.
 */
import { currentUser } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { getDb } from "@/db";
import { DomainError } from "@/domain/types";
import { authMode, opsEmails } from "@/server/env";
import { str } from "@/server/forms";
import { onboard, setupBrandOrganization } from "@/server/identity";
import { reportError } from "@/server/observability";
import { continueUrl, identityState, sessionClaims } from "@/server/session";

const fail = (path: string, err: unknown): never => {
  if (!(err instanceof DomainError)) reportError(err, { action: path });
  const msg = err instanceof DomainError ? err.message : "Something went wrong. Nothing was changed — please try again.";
  redirect(`${path}?error=${encodeURIComponent(msg)}`);
};

export async function onboardAction(fd: FormData) {
  if (authMode() !== "clerk") notFound();
  const claims = await sessionClaims();
  if (!claims) redirect("/sign-in");
  // The one Clerk API read in onboarding: the verified email and name, read once, outside any
  // transaction, and copied into users so no later request needs Clerk's API.
  const cu = await currentUser();
  if (!cu) redirect("/sign-in");
  const primary = cu.emailAddresses.find((e) => e.id === cu.primaryEmailAddressId);
  const choice = str(fd, "choice") === "brand" ? "brand" : "creator";
  const db = await getDb();
  let role: string = choice;
  try {
    role = await db.transaction((tx) =>
      onboard(tx, {
        subject: claims.subject,
        email: primary?.emailAddress ?? "",
        emailVerified: primary?.verification?.status === "verified",
        name: [cu.firstName, cu.lastName].filter(Boolean).join(" ") || cu.username || "",
        acceptedNotice: fd.get("accept_notice") === "on",
        productEmails: fd.get("product_emails") === "on",
        choice,
        orgId: claims.orgId,
        opsEmails: opsEmails(),
      }),
    );
  } catch (err) {
    fail("/onboarding", err);
  }
  // New creators finish their profile first: it stays private until then.
  if (role === "creator") redirect(`/creator/profile?notice=${encodeURIComponent("Welcome! Complete your profile so brands can find you.")}`);
  await goNext();
}

export async function setupBrandAction(fd: FormData) {
  if (authMode() !== "clerk") notFound();
  const claims = await sessionClaims();
  if (!claims) redirect("/sign-in");
  const db = await getDb();
  try {
    await db.transaction((tx) =>
      setupBrandOrganization(tx, {
        subject: claims.subject,
        orgId: claims.orgId,
        orgRole: claims.orgRole,
        legalName: str(fd, "legal_name"),
        displayName: str(fd, "display_name"),
        category: str(fd, "category"),
        website: str(fd, "website") || null,
      }),
    );
  } catch (err) {
    fail("/onboarding/brand", err);
  }
  await goNext();
}

async function goNext(): Promise<never> {
  const s = await identityState();
  redirect(continueUrl(s));
}
