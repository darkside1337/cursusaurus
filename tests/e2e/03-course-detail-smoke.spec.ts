import { test, expect } from "@playwright/test";
import { createIsolatedUser, createIsolatedCourse } from "./helpers/test-isolation";

test.describe("Spec 03: Course Detail Smoke Tests", () => {
  test("course detail page renders syllabus, pricing cards, and preview links", async ({
    page,
    context,
  }) => {
    const creator = await createIsolatedUser("creator", "DetailCreator");
    const learner = await createIsolatedUser("learner", "DetailLearner");
    await context.addCookies(learner.cookies);

    const course = await createIsolatedCourse(creator.id, {
      title: `Differential Geometry Monograph ${crypto.randomUUID().slice(0, 6)}`,
      priceCents: 6900,
      isPublished: true,
    });

    await page.goto(`/${course.slug}`);

    // Verify Title & Pricing
    await expect(page.getByText(course.title)).toBeVisible();
    await expect(page.getByText(/Buy course/i)).toBeVisible();
    await expect(page.getByText("All-Access Pass").first()).toBeVisible();

    // Verify Syllabus lessons render
    for (const lesson of course.lessons) {
      await expect(page.getByText(lesson.title)).toBeVisible();
    }

    // Verify clicking preview lesson navigates to classroom player
    const previewLesson = course.lessons.find((l) => l.isPreview);
    expect(previewLesson).toBeDefined();

    await page.locator(`a[href*="/learn/${course.slug}/${previewLesson!.slug}"]`).click();
    await expect(page).toHaveURL(new RegExp(`/learn/${course.slug}/${previewLesson!.slug}`));
  });
});
