import { expect, test } from "@playwright/test";

test("demo sign-in does not exist outside the demo", async ({ page }) => {
  const res = await page.goto("/login");
  expect(res?.status()).toBe(404);
});

test("job worker rejects requests without the cron secret", async ({ request }) => {
  expect((await request.get("/api/jobs/run")).status()).toBe(401);
  expect((await request.get("/api/jobs/run", { headers: { authorization: "Bearer e2e-cron" } })).status()).toBe(200);
});

test("staging shows no demo copy", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Demo build")).toHaveCount(0);
});
