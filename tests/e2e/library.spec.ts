import { test, expect } from "@playwright/test";

test.describe("Library Surface Smoke Tests", () => {
  test("unauthenticated access redirects to /login with callbackUrl", async ({ page }) => {
    await page.goto("/library");
    await expect(page).toHaveURL(/\/login\?callbackUrl=%2Flibrary|\/login\?callbackUrl=\/library/);
  });
});
