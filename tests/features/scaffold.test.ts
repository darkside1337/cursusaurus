import { describe, it, expect } from "vitest";
import * as features from "@/features";
import {
  createCourseSchema,
  coursePriceCentsSchema,
  generateSlug,
} from "@/features/courses";
import { createPurchaseCheckoutSchema } from "@/features/purchases";
import { createSubscriptionCheckoutSchema, createCustomerPortalSchema } from "@/features/subscriptions";
import { hasAccessSchema, grantEntitlementSchema, revokeEntitlementSchema } from "@/features/entitlements";
import { signedPlaybackUrlSchema } from "@/features/video";
import { updateProgressSchema, getLessonProgressSchema } from "@/features/progress";

describe("Phase 0 Features Scaffolding", () => {
  it("exports all 6 bounded context modules from @/features", () => {
    expect(features.courses).toBeDefined();
    expect(features.purchases).toBeDefined();
    expect(features.subscriptions).toBeDefined();
    expect(features.entitlements).toBeDefined();
    expect(features.video).toBeDefined();
    expect(features.progress).toBeDefined();
  });

  describe("courses feature", () => {
    it("generates correct URL slugs", () => {
      expect(generateSlug("Introduction to TypeScript")).toBe("introduction-to-typescript");
      expect(generateSlug("Advanced Next.js 16 & React 19!")).toBe("advanced-nextjs-16-react-19");
    });

    it("enforces $19–$199 pricing boundary per PRD §8", () => {
      // Valid boundaries
      expect(coursePriceCentsSchema.safeParse(1900).success).toBe(true);
      expect(coursePriceCentsSchema.safeParse(19900).success).toBe(true);
      expect(coursePriceCentsSchema.safeParse(4900).success).toBe(true);

      // Below $19 (1899 cents)
      const below = coursePriceCentsSchema.safeParse(1899);
      expect(below.success).toBe(false);

      // Above $199 (19901 cents)
      const above = coursePriceCentsSchema.safeParse(19901);
      expect(above.success).toBe(false);

      // Non-integer cents
      const nonInt = coursePriceCentsSchema.safeParse(49.99);
      expect(nonInt.success).toBe(false);
    });

    it("validates create course schema", () => {
      const valid = createCourseSchema.safeParse({
        title: "Web Design Systems",
        priceCents: 4900,
        creatorId: "user_123",
      });
      expect(valid.success).toBe(true);

      const invalid = createCourseSchema.safeParse({
        title: "W",
        priceCents: 500,
        creatorId: "user_123",
      });
      expect(invalid.success).toBe(false);
    });
  });

  describe("purchases feature", () => {
    it("validates create purchase checkout schema", () => {
      const valid = createPurchaseCheckoutSchema.safeParse({
        userId: "user_123",
        courseId: "course_456",
        successUrl: "https://example.com/checkout/success?session_id={CHECKOUT_SESSION_ID}",
        cancelUrl: "https://example.com/courses/react",
      });
      expect(valid.success).toBe(true);

      const invalid = createPurchaseCheckoutSchema.safeParse({
        userId: "",
        courseId: "course_456",
        successUrl: "not-a-url",
        cancelUrl: "https://example.com/courses/react",
      });
      expect(invalid.success).toBe(false);
    });
  });

  describe("subscriptions feature", () => {
    it("validates subscription checkout and portal schemas", () => {
      const subValid = createSubscriptionCheckoutSchema.safeParse({
        userId: "user_123",
        customerEmail: "user@example.com",
        priceId: "price_abc123",
        successUrl: "https://example.com/billing",
        cancelUrl: "https://example.com/pricing",
      });
      expect(subValid.success).toBe(true);

      const portalValid = createCustomerPortalSchema.safeParse({
        customerId: "cus_123",
        returnUrl: "https://example.com/billing",
      });
      expect(portalValid.success).toBe(true);
    });
  });

  describe("entitlements feature", () => {
    it("validates hasAccess input schema", () => {
      expect(hasAccessSchema.safeParse({ userId: "u1", courseId: "c1" }).success).toBe(true);
      expect(hasAccessSchema.safeParse({ userId: "", courseId: "c1" }).success).toBe(false);
    });

    it("validates grant and revoke entitlement schemas", () => {
      // Course-scoped purchase grant
      expect(
        grantEntitlementSchema.safeParse({
          userId: "u1",
          courseId: "c1",
          source: "purchase",
        }).success
      ).toBe(true);

      // All-access subscription grant (courseId is null or undefined)
      expect(
        grantEntitlementSchema.safeParse({
          userId: "u1",
          courseId: null,
          source: "subscription",
        }).success
      ).toBe(true);

      // Revoke schema
      expect(
        revokeEntitlementSchema.safeParse({
          userId: "u1",
          courseId: null,
          source: "subscription",
        }).success
      ).toBe(true);
    });
  });

  describe("video feature", () => {
    it("validates video playback URL schema with default expiration", () => {
      const parsed = signedPlaybackUrlSchema.parse({
        userId: "user_123",
        courseId: "course_456",
        lessonSlug: "01-introduction",
      });
      expect(parsed.expiresInSeconds).toBe(60);

      const invalid = signedPlaybackUrlSchema.safeParse({
        userId: "",
        courseId: "course_456",
        lessonSlug: "01-introduction",
      });
      expect(invalid.success).toBe(false);
    });
  });

  describe("progress feature", () => {
    it("validates progress update and fetch schemas", () => {
      expect(
        updateProgressSchema.safeParse({
          userId: "user_123",
          courseId: "course_456",
          lessonSlug: "01-intro",
          completed: true,
          lastPositionSeconds: 120,
        }).success
      ).toBe(true);

      expect(
        getLessonProgressSchema.safeParse({
          userId: "user_123",
          courseId: "course_456",
          lessonSlug: "01-intro",
        }).success
      ).toBe(true);
    });
  });
});
