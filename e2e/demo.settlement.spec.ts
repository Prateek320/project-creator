import { expect, test } from "@playwright/test";

test("brand approves a settlement and pays out through the job queue", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await page.goto("/login");
  await page.locator('form:has(input[value="aarav@glowbotanics.demo"]) button').click();
  await expect(page).toHaveURL(/\/brand/);

  await page.goto("/brand");
  await page.getByRole("link", { name: /Approve earnings/ }).first().click();
  await expect(page.getByRole("heading", { name: "Settlement" })).toBeVisible();

  await page.getByRole("button", { name: /^Approve ₹/ }).click();
  await expect(page.getByText(/waiting for your approval/i)).toHaveCount(0);

  await page.getByRole("button", { name: /^Pay out ₹/ }).click();
  await expect(page.getByText("Payout requested")).toBeVisible();

  // The payout settles asynchronously; the page refreshes itself until the stamp lands.
  await expect(page.getByRole("img", { name: /Stamped paid/ })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Paid out/).first()).toBeVisible();
  await expect(page.getByText("₹0 ✓ balanced").first()).toBeVisible();
});

test("health check reports ok without leaking configuration", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.ok).toBe(true);
  expect(body).not.toHaveProperty("payments");
});
