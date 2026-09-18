import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import {
  getTestDb,
  cleanDb,
  seedUser,
  seedCourse,
  seedLesson,
  seedPurchase,
  seedSubscription,
  seedEntitlement,
  type TestDb,
} from "../helpers";

let testDb: TestDb;

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

const mockStripeSessionsCreate = vi.fn();
vi.mock("@/lib/stripe", () => ({
  stripe: {
    checkout: {
      sessions: {
        create: (...args: unknown[]) => mockStripeSessionsCreate(...args),
      },
    },
  },
}));

let mockUser: { id: string; email: string } | null = null;
vi.mock("@/lib/auth", () => ({
  getServerSession: vi.fn(async () => {
    if (!mockUser) return null;
    return {
      user: {
        id: mockUser.id,
        email: mockUser.email,
        name: "Test User",
      },
      session: {
        id: "session_123",
        userId: mockUser.id,
      },
    };
  }),
}));

import { createPurchaseCheckoutSession } from "@/features/purchases/checkout";
import { createCourseCheckoutSessionAction } from "@/features/purchases/actions";

describe("Slice 1 — Purchases Checkout Domain & Action", () => {
  let user: { id: string; email: string };
  let creator: { id: string };

  beforeAll(async () => {
    testDb = await getTestDb();
  });

  beforeEach(async () => {
    await cleanDb(testDb);
    vi.clearAllMocks();

    user = await seedUser(testDb, { email: "buyer@example.com" });
    creator = await seedUser(testDb, { name: "Creator 1" });
    mockUser = user;

    mockStripeSessionsCreate.mockResolvedValue({
      id: "cs_test_purchase_123",
      url: "https://checkout.stripe.com/c/pay/cs_test_purchase_123",
    });
  });

  describe("createPurchaseCheckoutSession", () => {
    it("throws an error when course does not exist", async () => {
      await expect(
        createPurchaseCheckoutSession({
          userId: user.id,
          courseId: "non_existent_course",
          successUrl: "https://example.com/success",
          cancelUrl: "https://example.com/cancel",
        })
      ).rejects.toThrow("Course not found");
    });

    it("throws an error when course is unpublished", async () => {
      const course = await seedCourse(testDb, {
        creatorId: creator.id,
        isPublished: false,
      });

      await expect(
        createPurchaseCheckoutSession({
          userId: user.id,
          courseId: course.id,
          successUrl: "https://example.com/success",
          cancelUrl: "https://example.com/cancel",
        })
      ).rejects.toThrow("Course is not available for purchase");
    });

    it("throws an error when published course has 0 lessons (not purchase-eligible)", async () => {
      const course = await seedCourse(testDb, {
        creatorId: creator.id,
        isPublished: true,
      });

      await expect(
        createPurchaseCheckoutSession({
          userId: user.id,
          courseId: course.id,
          successUrl: "https://example.com/success",
          cancelUrl: "https://example.com/cancel",
        })
      ).rejects.toThrow("Course does not meet purchase eligibility criteria");
    });

    it("reads price strictly from course.priceCents server-side and enables dynamic payment methods", async () => {
      const course = await seedCourse(testDb, {
        creatorId: creator.id,
        isPublished: true,
        priceCents: 8900,
      });
      await seedLesson(testDb, { courseId: course.id });

      const result = await createPurchaseCheckoutSession({
        userId: user.id,
        userEmail: user.email,
        courseId: course.id,
        successUrl: "https://example.com/success?session_id={CHECKOUT_SESSION_ID}",
        cancelUrl: "https://example.com/cancel",
      });

      expect(result.sessionId).toBe("cs_test_purchase_123");
      expect(result.url).toBe("https://checkout.stripe.com/c/pay/cs_test_purchase_123");

      const [params] = mockStripeSessionsCreate.mock.calls[0];
      expect(params.mode).toBe("payment");
      // D13: payment_method_types must be omitted
      expect(params.payment_method_types).toBeUndefined();
      expect(params.line_items[0].price_data.unit_amount).toBe(8900);
      expect(params.metadata).toEqual({
        userId: user.id,
        courseId: course.id,
        courseSlug: course.slug,
        purchaseType: "one_time",
      });
    });

    it("enforces mutual exclusivity: passes customer when stripeCustomerId exists", async () => {
      const course = await seedCourse(testDb, { creatorId: creator.id, isPublished: true });
      await seedLesson(testDb, { courseId: course.id });

      await createPurchaseCheckoutSession({
        userId: user.id,
        userEmail: user.email,
        stripeCustomerId: "cus_existing_123",
        courseId: course.id,
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
      });

      const [params] = mockStripeSessionsCreate.mock.calls[0];
      expect(params.customer).toBe("cus_existing_123");
      expect(params.customer_email).toBeUndefined();
    });

    it("enforces mutual exclusivity: passes customer_email when stripeCustomerId is absent", async () => {
      const course = await seedCourse(testDb, { creatorId: creator.id, isPublished: true });
      await seedLesson(testDb, { courseId: course.id });

      await createPurchaseCheckoutSession({
        userId: user.id,
        userEmail: "buyer@example.com",
        courseId: course.id,
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
      });

      const [params] = mockStripeSessionsCreate.mock.calls[0];
      expect(params.customer).toBeUndefined();
      expect(params.customer_email).toBe("buyer@example.com");
    });
  });

  describe("createCourseCheckoutSessionAction", () => {
    it("returns unauthorized when user is not logged in", async () => {
      mockUser = null;
      const course = await seedCourse(testDb, { creatorId: creator.id, isPublished: true });
      await seedLesson(testDb, { courseId: course.id });

      const res = await createCourseCheckoutSessionAction(course.id);
      expect(res.error).toBe("unauthorized");
      expect(res.loginUrl).toBe(`/login?callbackUrl=/${course.slug}`);
    });

    it("blocks checkout if user already completed purchase for the course (Invariant #12)", async () => {
      const course = await seedCourse(testDb, { creatorId: creator.id, isPublished: true });
      await seedLesson(testDb, { courseId: course.id });

      await seedPurchase(testDb, {
        userId: user.id,
        courseId: course.id,
        status: "completed",
      });

      const res = await createCourseCheckoutSessionAction(course.id);
      expect(res.error).toBe("You already own this course monograph.");
    });

    it("blocks checkout if user already has an active purchase entitlement", async () => {
      const course = await seedCourse(testDb, { creatorId: creator.id, isPublished: true });
      await seedLesson(testDb, { courseId: course.id });

      await seedEntitlement(testDb, {
        userId: user.id,
        courseId: course.id,
        source: "purchase",
      });

      const res = await createCourseCheckoutSessionAction(course.id);
      expect(res.error).toBe("You already own this course monograph.");
    });

    it("allows a subscriber without outright purchase to buy course (overlap flow)", async () => {
      const course = await seedCourse(testDb, { creatorId: creator.id, isPublished: true });
      await seedLesson(testDb, { courseId: course.id });

      // User has active All-Access subscription entitlement (courseId = null)
      await seedSubscription(testDb, {
        userId: user.id,
        stripeCustomerId: "cus_sub_456",
        status: "active",
      });
      await seedEntitlement(testDb, {
        userId: user.id,
        courseId: null,
        source: "subscription",
      });

      const res = await createCourseCheckoutSessionAction(course.id);
      expect(res.error).toBeUndefined();
      expect(res.url).toBe("https://checkout.stripe.com/c/pay/cs_test_purchase_123");

      const [params] = mockStripeSessionsCreate.mock.calls[0];
      // Reuses stripeCustomerId from subscriptions
      expect(params.customer).toBe("cus_sub_456");
      // Contains literal {CHECKOUT_SESSION_ID}
      expect(params.success_url).toContain("?session_id={CHECKOUT_SESSION_ID}");
    });
  });
});
