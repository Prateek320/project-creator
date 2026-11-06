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

test("staging sends people to managed sign-in, never the demo picker", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('a[href^="/login"]')).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
});

test("without Clerk keys, staging fails closed: no sign-in, no onboarding, no workspace", async ({ page }) => {
  for (const path of ["/sign-in", "/sign-up", "/onboarding", "/onboarding/brand"]) {
    expect((await page.goto(path))?.status(), path).toBe(404);
  }
  await page.goto("/brand");
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("the privacy notice is public and says where data is stored", async ({ page }) => {
  expect((await page.goto("/privacy"))?.status()).toBe(200);
  await expect(page.getByText("stored in Singapore")).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
});
