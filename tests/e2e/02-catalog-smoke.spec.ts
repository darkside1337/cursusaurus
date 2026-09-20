import { test, expect } from "@playwright/test";
import { createIsolatedUser, createIsolatedCourse } from "./helpers/test-isolation";

test.describe("Spec 02: Public Catalog Smoke Tests", () => {
  test("catalog renders published courses and filters by category", async ({ page }) => {
    const creator = await createIsolatedUser("creator", "CatCreator");
    const pubCourse = await createIsolatedCourse(creator.id, {
      title: `Unique Quantum Design Monograph ${crypto.randomUUID().slice(0, 6)}`,
      category: "Design",
      isPublished: true,
    });
    const draftCourse = await createIsolatedCourse(creator.id, {
      title: `Secret Draft Never Published ${crypto.randomUUID().slice(0, 6)}`,
      isPublished: false,
    });

    await page.goto("/");

    // Published course is visible
    await expect(page.getByText(pubCourse.title)).toBeVisible();

    // Draft course is completely hidden
    await expect(page.getByText(draftCourse.title)).toHaveCount(0);

    // Filter category
    const codePill = page.getByRole("button", { name: "Code" }).or(page.getByText("Code"));
    if (await codePill.count() > 0) {
      await codePill.first().click();
      // Since pubCourse is in Design category, filtering by Code should filter it out
      await expect(page.getByText(pubCourse.title)).toHaveCount(0);
    }
  });
});
