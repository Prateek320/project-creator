/**
 * Sentry on the server (Node and edge). Off unless SENTRY_DSN is set, so the demo and CI send nothing.
 * Errors only (no tracing) to stay inside the free tier; no request bodies, headers, cookies or user info.
 */
import * as Sentry from "@sentry/nextjs";

export function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.APP_ENV ?? "unknown",
    tracesSampleRate: 0,
    // DPDP: send stack traces, not personal data. Bodies of server actions carry names and emails.
    dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
  });
}

export const onRequestError = Sentry.captureRequestError;
