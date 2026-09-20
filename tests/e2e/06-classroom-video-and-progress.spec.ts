import { test, expect } from "@playwright/test";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { entitlements, lessonProgress } from "@/lib/db/schema";
import { createIsolatedUser, createIsolatedCourse } from "./helpers/test-isolation";

test.describe("Spec 06: Video Delivery & Classroom Progress", () => {
  test("Learner can play free preview lesson video and metadata loads (readyState >= 1)", async ({
    page,
    context,
  }) => {
    const creator = await createIsolatedUser("creator", "PreviewCreator");
    const learner = await createIsolatedUser("learner", "PreviewLearner");
    const course = await createIsolatedCourse(creator.id, { isPublished: true });
    const previewLesson = course.lessons.find((l) => l.isPreview);
    expect(previewLesson).toBeDefined();

    // Authenticated learner without course entitlement visits free preview
    await context.addCookies(learner.cookies);
    await page.goto(`/learn/${course.slug}/${previewLesson!.slug}`);

    // Verify video element mounts
    const video = page.locator("video");
    await expect(video).toBeVisible({ timeout: 15000 });

    // Assert video metadata loads via readyState >= 1 (HAVE_METADATA)
    await page.waitForFunction(
      () => {
        const el = document.querySelector("video");
        return el !== null && el.readyState >= 1;
      },
      { timeout: 15000 }
    );
  });

  test("Gated lesson displays enrolled learners card and suppresses video for non-entitled user", async ({
    page,
    context,
  }) => {
    const creator = await createIsolatedUser("creator", "GatedCreator");
    const nonEntitledUser = await createIsolatedUser("learner", "NonEntitledLearner");
    const course = await createIsolatedCourse(creator.id, { isPublished: true });
    const paidLesson = course.lessons.find((l) => !l.isPreview);
    expect(paidLesson).toBeDefined();

    await context.addCookies(nonEntitledUser.cookies);

    // Open gated lesson
    await page.goto(`/learn/${course.slug}/${paidLesson!.slug}`);

    // Verify the locked lesson card is shown
    await expect(
      page.getByText("This lesson is reserved for enrolled learners")
    ).toBeVisible();
    await expect(page.getByText("View Enrollment Options")).toBeVisible();

    // Verify video element is NOT rendered
    await expect(page.locator("video")).toHaveCount(0);
  });

  test("Entitled learner can toggle lesson completion manually and persists in DB", async ({
    page,
    context,
  }) => {
    const creator = await createIsolatedUser("creator", "ProgressCreator");
    const learner = await createIsolatedUser("learner", "ProgressLearner");
    const course = await createIsolatedCourse(creator.id, { isPublished: true });
    const lesson = course.lessons[0];

    // Grant entitlement
    await db.insert(entitlements).values({
      id: crypto.randomUUID(),
      userId: learner.id,
      courseId: course.id,
      source: "purchase",
    });

    await context.addCookies(learner.cookies);

    // Open classroom lesson
    await page.goto(`/learn/${course.slug}/${lesson.slug}`);

    // Locate the completion toggle button ("Mark as Complete")
    const toggleButton = page.getByRole("button", { name: "Mark as Complete" });
    await expect(toggleButton).toBeVisible();

    // Click "Mark as Complete"
    await toggleButton.click();

    // Button should now transition to "Completed"
    await expect(
      page.getByRole("button", { name: "Completed" })
    ).toBeVisible();

    // Verify persistence in DB via expect.poll
    await expect.poll(async () => {
      const [progress] = await db
        .select()
        .from(lessonProgress)
        .where(
          and(
            eq(lessonProgress.userId, learner.id),
            eq(lessonProgress.lessonId, lesson.id)
          )
        );
      return progress?.completed;
    }).toBe(true);

    // Click again to mark incomplete
    await page.getByRole("button", { name: "Completed" }).click();
    await expect(
      page.getByRole("button", { name: "Mark as Complete" })
    ).toBeVisible();

    await expect.poll(async () => {
      const [updatedProgress] = await db
        .select()
        .from(lessonProgress)
        .where(
          and(
            eq(lessonProgress.userId, learner.id),
            eq(lessonProgress.lessonId, lesson.id)
          )
        );
      return updatedProgress?.completed;
    }).toBe(false);
  });
});
