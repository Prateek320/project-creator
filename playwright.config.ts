/**
 * End-to-end tests against a production build, in two environments from the same build:
 *  - demo (port 3100): the seeded walkthrough, on its own throwaway PGlite database
 *  - staging (port 3101): proves demo-only surfaces don't exist outside the demo
 */
import { defineConfig } from "@playwright/test";

const build = "NEXT_DIST_DIR=.next-e2e npx next build";
const start = (port: number, env: string) =>
  `NEXT_DIST_DIR=.next-e2e APP_ENV=${env} PGLITE_DIR=.data-e2e/${env} SESSION_SECRET=e2e-session CRON_SECRET=e2e-cron ENCRYPTION_KEY=${Buffer.alloc(32, 7).toString("base64")} npx next start -p ${port}`;

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
