/** Sentry in the browser. Off unless NEXT_PUBLIC_SENTRY_DSN is set. Events go through /monitoring (same origin). */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_APP_ENV ?? "unknown",
    tracesSampleRate: 0,
    // DPDP: send stack traces, not personal data. Bodies of server actions carry names and emails.
    dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
