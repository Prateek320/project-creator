import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

/**
 * Content Security Policy, report-only for now: Next.js and the theme script inject inline scripts,
 * so enforcing needs per-request nonces (slice 2). Report-only shows violations in the browser
 * console without breaking anything, so we can tighten with evidence.
 */
const csp = [
  "default-src 'self'",
  // React's dev build evaluates strings for debugging; production builds don't need unsafe-eval.
  // Clerk: its frontend API on *.clerk.accounts.dev (dev) or clerk.<domain> (prod), avatars on
  // img.clerk.com, and Cloudflare's bot-protection challenge on sign-up.
  `script-src 'self' 'unsafe-inline' https://*.clerk.accounts.dev https://challenges.cloudflare.com${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://img.clerk.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.clerk.accounts.dev https://clerk-telemetry.com",
  "frame-src https://challenges.cloudflare.com",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // Lets e2e runs build into their own folder without disturbing a running `next dev`.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // PGlite ships WASM + data files; keep it out of the server bundle.
  serverExternalPackages: ["@electric-sql/pglite"],
  poweredByHeader: false,
  // Lets the browser Sentry client tag events with the environment.
  env: { NEXT_PUBLIC_APP_ENV: process.env.APP_ENV ?? "" },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy-Report-Only", value: csp },
          // HSTS only where every subdomain is HTTPS for good: production.
          ...(process.env.APP_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
        ],
      },
    ];
  },
};

// Uploads source maps only when SENTRY_AUTH_TOKEN (plus SENTRY_ORG / SENTRY_PROJECT) is set, i.e. on Vercel.
// Browser events are tunnelled through /monitoring, so the CSP stays 'self' and ad blockers don't drop them.
export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
  telemetry: false,
  tunnelRoute: "/monitoring",
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
});
