/**
 * Who is making this request. `getActor()` is the only integration point with authentication;
 * every service authorises by Actor.
 *
 *  - clerk mode (staging, production, development with Clerk keys): the Clerk session, mapped onto a
 *    proovd user by src/server/identity.ts.
 *  - cookie mode (demo, development without Clerk keys): a signed, httpOnly cookie holding the user id,
 *    set by the demo account picker.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/db";
import { loadActor, type Actor } from "./core";
import { authMode, sessionSecret } from "./env";
import { resolveIdentity, type IdentityState, type SessionClaims } from "./identity";

const COOKIE = "pc_session";

const sign = (v: string) => createHmac("sha256", sessionSecret()).update(v).digest("base64url");

export async function setSession(userId: string) {
  const store = await cookies();
  store.set(COOKIE, `${userId}.${sign(userId)}`, {
    httpOnly: true,
    sameSite: "lax",
    // Secure everywhere except plain-http localhost, so a deployed demo also gets a Secure cookie.
    secure: !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test((await headers()).get("host") ?? ""),
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}

async function cookieActor(): Promise<Actor | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [userId, sig] = raw.split(".");
  if (!userId || !sig) return null;
  const expected = Buffer.from(sign(userId));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return loadActor(await getDb(), userId);
}

/** The Clerk session as plain claims, or null when signed out. Reads the verified session token; no network call. */
export async function sessionClaims(): Promise<SessionClaims | null> {
  const a = await auth();
  if (!a.userId) return null;
  const fva = a.sessionClaims?.fva;
  return { subject: a.userId, orgId: a.orgId ?? null, orgRole: a.orgRole ?? null, secondFactorAge: fva ? fva[1] : null };
}

/** Full sign-in state, resolved once per request. `null` means signed out. */
export const identityState = cache(async (): Promise<IdentityState | null> => {
  const mode = authMode();
  if (mode === "off") return null;
  if (mode === "cookie") {
    const actor = await cookieActor();
    return actor ? { kind: "ok", actor } : null;
  }
  const claims = await sessionClaims();
  return claims ? resolveIdentity(await getDb(), claims) : null;
});

/** The signed-in actor, or null if signed out or still has a setup step (onboarding, brand setup, MFA) left. */
export async function getActor(): Promise<Actor | null> {
  const s = await identityState();
  return s?.kind === "ok" ? s.actor : null;
}

/** Where someone who is signed in but not fully set up should go next. */
export function nextStepFor(s: IdentityState | null): string | null {
  if (!s) return authMode() === "cookie" ? "/login" : "/sign-in";
  switch (s.kind) {
    case "ok":
      return null;
    case "onboarding":
      return "/onboarding";
    case "brand_setup":
      return "/onboarding/brand";
    case "mfa_required":
      return "/onboarding/mfa";
    case "disabled":
      return "/onboarding/disabled";
  }
}

export async function requireActor(role?: Actor["role"]): Promise<Actor> {
  const s = await identityState();
  if (s?.kind !== "ok") redirect(nextStepFor(s)!);
  if (role && s.actor.role !== role) redirect(homeFor(s.actor));
  return s.actor;
}

/** Where to send someone right now: their next setup step, or their home once fully set up. */
export const continueUrl = (s: IdentityState | null): string => (s?.kind === "ok" ? homeFor(s.actor) : nextStepFor(s)!);

export function homeFor(a: Pick<Actor, "role">): string {
  return a.role === "brand" ? "/brand" : a.role === "creator" ? "/creator" : "/admin";
}
