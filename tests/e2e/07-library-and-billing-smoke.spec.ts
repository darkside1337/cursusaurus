import { test, expect } from "@playwright/test";
import { db } from "@/lib/db/db";
import { entitlements, subscriptions } from "@/lib/db/schema";
import { createIsolatedUser, createIsolatedCourse } from "./helpers/test-isolation";

test.describe("Spec 07: Library & Billing Smoke Tests", () => {
  test("library renders owned courses with AccessBadge and zero pricing chrome", async ({
    page,
    context,
  }) => {
    const creator = await createIsolatedUser("creator", "LibCreator");
    const learner = await createIsolatedUser("learner", "LibLearner");
    const course = await createIsolatedCourse(creator.id);

    // Grant purchase entitlement
    await db.insert(entitlements).values({
      id: crypto.randomUUID(),
      userId: learner.id,
      courseId: course.id,
      source: "purchase",
    });

    await context.addCookies(learner.cookies);

    await page.goto("/library");

    // Course title is visible
    await expect(page.getByText(course.title)).toBeVisible();

    // Access badge displays "Purchased"
    await expect(page.getByText("Purchased")).toBeVisible();

    // Verify ZERO pricing chrome or checkout CTAs
    await expect(page.getByText("Buy this course")).toHaveCount(0);
    await expect(page.getByText("$15 / month")).toHaveCount(0);
  });

  test("billing page displays active subscription status with portal link", async ({
    page,
    context,
  }) => {
    const subscriber = await createIsolatedUser("learner", "BillingActiveUser");
    await context.addCookies(subscriber.cookies);

    const subId = `sub_bill_${crypto.randomUUID().slice(0, 8)}`;
    await db.insert(subscriptions).values({
      id: crypto.randomUUID(),
      userId: subscriber.id,
      stripeSubscriptionId: subId,
      stripeCustomerId: `cus_bill_${crypto.randomUUID().slice(0, 8)}`,
      status: "active",
      currentPeriodEnd: new Date(Date.now() + 30 * 86400 * 1000),
      cancelAtPeriodEnd: false,
    });

    await page.goto("/billing");

    await expect(page.getByText("All-Access Pass — Active")).toBeVisible();
    await expect(page.getByText("Manage on Stripe Customer Portal")).toBeVisible();
  });

  test("billing page displays payment failed / past_due warning card with update link", async ({
    page,
    context,
  }) => {
    const pastDueUser = await createIsolatedUser("learner", "PastDueUser");
    await context.addCookies(pastDueUser.cookies);

    const subId = `sub_pd_${crypto.randomUUID().slice(0, 8)}`;
    await db.insert(subscriptions).values({
      id: crypto.randomUUID(),
      userId: pastDueUser.id,
      stripeSubscriptionId: subId,
      stripeCustomerId: `cus_pd_${crypto.randomUUID().slice(0, 8)}`,
      status: "past_due",
      currentPeriodEnd: new Date(Date.now() + 30 * 86400 * 1000),
      cancelAtPeriodEnd: false,
    });

    await page.goto("/billing");

    // Verify amber warning card for past_due
    await expect(page.getByText("All-Access Pass — Payment Past Due")).toBeVisible();
    await expect(
      page.getByText("Renewal payment failed · Catalog access is currently paused")
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Update Payment Method" })).toBeVisible();
  });
});
