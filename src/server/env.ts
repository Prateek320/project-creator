/**
 * Runtime environment. One place decides which environment we are in and which secrets it needs.
 *
 *  - demo:        mock providers, seeded data, demo sign-in, reset and simulators. Zero setup.
 *  - development: a developer's machine against a real Postgres. No demo shortcuts unless seeded.
 *  - staging:     sandbox providers, real database, real sign-in (slice 2).
 *  - production:  live.
 *
 * APP_ENV defaults to "demo" only for the zero-setup case (embedded PGlite, not a production build),
 * so `npm run dev` keeps working with no configuration. Anywhere else it must be set explicitly.
 *
 * Values are read on every call (cheap) so tests can change process.env between cases.
 * This module must not import from ./core or @/db: both depend on it.
 */
import { createHash } from "node:crypto";
import { DomainError } from "@/domain/types";

export const APP_ENVS = ["demo", "development", "staging", "production"] as const;
export type AppEnv = (typeof APP_ENVS)[number];

export function appEnv(): AppEnv {
  const raw = process.env.APP_ENV;
  if (raw) {
    if (!(APP_ENVS as readonly string[]).includes(raw)) throw new Error(`APP_ENV must be one of ${APP_ENVS.join(", ")} (got "${raw}")`);
    return raw as AppEnv;
  }
  if (!process.env.DATABASE_URL && process.env.NODE_ENV !== "production") return "demo";
  throw new Error("APP_ENV must be set when DATABASE_URL is set or NODE_ENV=production");
}

export const isDemo = () => appEnv() === "demo";
/** Environments where dev-only secret fallbacks are acceptable. */
export const isLocal = () => {
  const e = appEnv();
  return e === "demo" || e === "development";
};

/** Throws a "not found" domain error outside the demo, so demo-only actions look like they don't exist. */
export function assertDemo(): void {
  if (!isDemo()) throw new DomainError("Not found");
}

function required(name: string, devFallback: string): string {
  const v = process.env[name];
  if (v) return v;
  if (isLocal()) return devFallback;
  throw new Error(`${name} must be set when APP_ENV=${appEnv()}`);
}

/** HMAC key for the demo session cookie. */
export const sessionSecret = () => required("SESSION_SECRET", "dev-only-insecure-secret");

/** Bearer token Vercel Cron (or any scheduler) must send to /api/jobs/run. */
export const cronSecret = () => required("CRON_SECRET", "dev-only-cron-secret");

/** 32-byte AES-256-GCM key for secrets at rest, base64-encoded. */
export function encryptionKey(): Buffer {
  const raw = required("ENCRYPTION_KEY", createHash("sha256").update("proovd-dev-only-encryption-key").digest("base64"));
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("ENCRYPTION_KEY must be 32 bytes, base64-encoded (openssl rand -base64 32)");
  return key;
}

/** Both Clerk keys present. Without them (zero-setup demo, CI) Clerk stays off entirely. */
export const clerkConfigured = () => Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);

/**
 * How getActor() identifies people.
 *  - cookie: the demo account picker (demo), or a developer's machine without Clerk keys (development).
 *  - clerk:  everywhere Clerk keys are set (staging and production must set them).
 *  - off:    staging/production without Clerk keys. Fails closed: public pages render, nobody can sign in.
 */
let warnedOff = false;
export function authMode(): "cookie" | "clerk" | "off" {
  if (isDemo()) return "cookie";
  if (clerkConfigured()) return "clerk";
  if (isLocal()) return "cookie";
  if (!warnedOff) {
    warnedOff = true;
    console.error(`[auth] APP_ENV=${appEnv()} has no Clerk keys (NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY): sign-in is off`);
  }
  return "off";
}

/** Verified email addresses that become platform operations (admin) users at onboarding. */
export const opsEmails = (): Set<string> =>
  new Set((process.env.OPS_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean));

/** Public base URL for links in emails, e.g. https://staging.proovd.in. */
export function appUrl(): string {
  const v = process.env.APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "");
  if (v) return v.replace(/\/$/, "");
  if (isLocal()) return "http://localhost:3000";
  throw new Error(`APP_URL must be set when APP_ENV=${appEnv()}`);
}
