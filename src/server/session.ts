/**
 * Demo session: a signed, httpOnly cookie holding the user id.
 * Swap for a managed auth provider (e.g. Clerk, Auth.js, Supabase Auth) before beta —
 * only `getActor()` needs to change; every service already authorises by Actor.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { loadActor, type Actor } from "./core";

const COOKIE = "pc_session";

function secret(): string {
  const s = process.env.SESSION_SECRET;
  // The embedded demo database (no DATABASE_URL) may run without a secret; real deployments may not.
  if (!s && process.env.NODE_ENV === "production" && process.env.DATABASE_URL) {
    throw new Error("SESSION_SECRET must be set when running against a real database");
  }
  return s ?? "dev-only-insecure-secret";
}

const sign = (v: string) => createHmac("sha256", secret()).update(v).digest("base64url");

export async function setSession(userId: string) {
  const store = await cookies();
  store.set(COOKIE, `${userId}.${sign(userId)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}

export async function getActor(): Promise<Actor | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [userId, sig] = raw.split(".");
  if (!userId || !sig) return null;
  const expected = Buffer.from(sign(userId));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return loadActor(await getDb(), userId);
}

export async function requireActor(role?: Actor["role"]): Promise<Actor> {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (role && actor.role !== role) redirect(homeFor(actor));
  return actor;
}

export function homeFor(a: Pick<Actor, "role">): string {
  return a.role === "brand" ? "/brand" : a.role === "creator" ? "/creator" : "/admin";
}
