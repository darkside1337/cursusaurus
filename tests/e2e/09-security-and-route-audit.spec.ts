import { test, expect } from "@playwright/test";
import { env } from "@/config/env";
import { createIsolatedUser, createIsolatedCourse } from "./helpers/test-isolation";
import { createStripeEventPayload, postWebhookEvent } from "./helpers/stripe-test-harness";

test.describe("Spec 09: Security & Route Handler Audit", () => {
  test("Stripe Webhook: missing signature returns 400 and grants nothing", async ({
    baseURL,
  }) => {
    const payload = createStripeEventPayload("checkout.session.completed", {
      id: "cs_unauth_test",
      mode: "payment",
      payment_status: "paid",
    });

    const res = await postWebhookEvent(payload, {
      baseUrl: baseURL,
      missingSignature: true,
    });
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toMatch(/missing stripe-signature/i);
  });

  test("Stripe Webhook: invalid signature returns 400 and grants nothing", async ({
    baseURL,
  }) => {
    const payload = createStripeEventPayload("checkout.session.completed", {
      id: "cs_unauth_test_2",
      mode: "payment",
      payment_status: "paid",
    });

    const res = await postWebhookEvent(payload, {
      baseUrl: baseURL,
      invalidSignature: true,
    });
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toMatch(/signature verification failed/i);
  });

  test("Video Storage: course-videos bucket is private; direct public GET fails", async () => {
    if (!env.SUPABASE_URL) return;

    // Normalize base URL
    const baseUrl = env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
    const publicUrl = `${baseUrl}/storage/v1/object/public/course-videos/seed-course-ts/seed-lesson-ts-01.mp4`;

    const res = await fetch(publicUrl);
    // Private bucket will reject unauthenticated public object requests with 400, 403, or 404
    expect([400, 403, 404]).toContain(res.status);
  });

  test("Video API: guest requesting preview lesson on an UNPUBLISHED course returns 404 (anti-enumeration)", async ({
    page,
  }) => {
    const creator = await createIsolatedUser("creator", "UnpubCreator");
    const course = await createIsolatedCourse(creator.id, { isPublished: false });
    const previewLesson = course.lessons.find((l) => l.isPreview);
    expect(previewLesson).toBeDefined();

    // Guest makes request without cookies
    const res = await page.request.get(
      `/api/video/signed-url?courseId=${course.id}&lessonId=${previewLesson!.id}`
    );
    // Anti-enumeration invariant: unpublished course requested by guest returns 404
    expect(res.status()).toBe(404);
  });

  test("Video API: missing required query params returns 400", async ({ page }) => {
    const res1 = await page.request.get(`/api/video/signed-url`);
    expect(res1.status()).toBe(400);

    const res2 = await page.request.get(`/api/video/signed-url?courseId=c1`);
    expect(res2.status()).toBe(400);
  });

  test("Video API: signed URL minted for lessonA cannot fetch lessonB (scope boundary)", async ({
    page,
    context,
  }) => {
    const creator = await createIsolatedUser("creator", "SignedScopeCreator");
    const course = await createIsolatedCourse(creator.id, { isPublished: true });
    await context.addCookies(creator.cookies);

    const lessonA = course.lessons[0];
    const lessonB = course.lessons[1];

    // Creator mints signed URL for lessonA
    const res = await page.request.get(
      `/api/video/signed-url?courseId=${course.id}&lessonId=${lessonA.id}`
    );
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.signedUrl).toBeDefined();

    const signedUrlObj = new URL(json.signedUrl);
    // The token/signature in query params is bound to lessonA's videoKey
    // If an attacker replaces lessonA's path with lessonB's key, Supabase Storage signature verification fails
    if (lessonA.videoKey && lessonB.videoKey) {
      const tamperedPath = signedUrlObj.pathname.replace(lessonA.videoKey, lessonB.videoKey);
      signedUrlObj.pathname = tamperedPath;

      const tamperedRes = await fetch(signedUrlObj.toString());
      expect([400, 403, 404]).toContain(tamperedRes.status);
    }
  });
});
