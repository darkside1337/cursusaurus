import { test, expect } from "@playwright/test";
import { createIsolatedUser } from "./helpers/test-isolation";

test.describe("Spec 04: Creator Studio Smoke Tests", () => {
  test("creator can navigate to new course formulation and create draft course", async ({
    page,
    context,
  }) => {
    const creator = await createIsolatedUser("creator", "StudioCreator");
    await context.addCookies(creator.cookies);

    await page.goto("/dashboard/courses/new");

    const uniqueTitle = `Monograph by Creator ${crypto.randomUUID().slice(0, 6)}`;
    await page.locator("#title").fill(uniqueTitle);
    await page.locator("#price").fill("49");
    await page.locator("#description").fill("A deep editorial study into modern digital design.");

    await page.getByRole("button", { name: "Create course" }).click();

    // Expect redirect to curriculum studio page
    await expect(page).toHaveURL(/\/dashboard\/courses\/test-crs-|\/dashboard\/courses\/[a-zA-Z0-9_-]+/);
    await expect(page.getByRole("heading", { name: uniqueTitle })).toBeVisible();
  });
});
