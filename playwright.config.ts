/**
 * End-to-end tests against a production build, in two environments from the same build:
 *  - demo (port 3100): the seeded walkthrough, on its own throwaway PGlite database
 *  - staging (port 3101): proves demo-only surfaces don't exist outside the demo
 */
import { defineConfig } from "@playwright/test";

// Next.js loads .env.local (Neon DATABASE_URL, Clerk keys) unless a variable is already set, even to "".
// Blank them so e2e always runs on its own throwaway PGlite database and never touches a real Neon branch.
const isolate = "DATABASE_URL= DATABASE_URL_UNPOOLED= NEON_BRANCH= NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY= CLERK_SECRET_KEY=";
const build = `${isolate} NEXT_DIST_DIR=.next-e2e npx next build`;
const start = (port: number, env: string) =>
  `${isolate} NEXT_DIST_DIR=.next-e2e APP_ENV=${env} PGLITE_DIR=.data-e2e/${env} SESSION_SECRET=e2e-session CRON_SECRET=e2e-cron ENCRYPTION_KEY=${Buffer.alloc(32, 7).toString("base64")} npx next start -p ${port}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { channel: process.env.CI ? undefined : "chrome", trace: "retain-on-failure" },
  projects: [
    { name: "demo", testMatch: /demo\..*spec\.ts/, use: { baseURL: "http://localhost:3100" } },
    { name: "staging", testMatch: /staging\..*spec\.ts/, use: { baseURL: "http://localhost:3101" } },
  ],
  webServer: [
    { command: `rm -rf .data-e2e && ${build} && ${start(3100, "demo")}`, url: "http://localhost:3100/api/health", timeout: 240_000, reuseExistingServer: false },
    { command: start(3101, "staging"), url: "http://localhost:3101/api/health", timeout: 240_000, reuseExistingServer: false },
  ],
});
