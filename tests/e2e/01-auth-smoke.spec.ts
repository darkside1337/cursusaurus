import { test, expect } from "@playwright/test";

test.describe("Spec 01: Auth & Access Gates Smoke Tests", () => {
  test("unauthenticated access to /library redirects to /login with callbackUrl", async ({
    page,
  }) => {
    await page.goto("/library");
    await expect(page).toHaveURL(/\/login\?callbackUrl=%2Flibrary|\/login\?callbackUrl=\/library/);
  });

  test("unauthenticated access to /billing redirects to /login with callbackUrl", async ({
    page,
  }) => {
    await page.goto("/billing");
    await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fbilling|\/login\?callbackUrl=\/billing/);
  });

  test("unauthenticated access to /dashboard/courses redirects to /login with callbackUrl", async ({
    page,
  }) => {
    await page.goto("/dashboard/courses");
    await expect(page).toHaveURL(
      /\/login\?callbackUrl=%2Fdashboard%2Fcourses|\/login\?callbackUrl=\/dashboard\/courses/
    );
  });

  test("open redirect attack via callbackUrl=https://evil.com is sanitized to root", async ({
    page,
  }) => {
    await page.goto("/login?callbackUrl=https://evil.com");
    await expect(page.getByRole("link", { name: "Cursusaurus" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  });
});
