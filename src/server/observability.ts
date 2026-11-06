/** Error reporting. Sentry when configured (src/instrumentation.ts); always the server log. */
import * as Sentry from "@sentry/nextjs";

export function reportError(err: unknown, context: Record<string, string | number | boolean> = {}) {
  console.error(err);
  if (Sentry.isInitialized()) Sentry.captureException(err, { tags: context });
}
