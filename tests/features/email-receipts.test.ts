import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import {
  getTestDb,
  cleanDb,
  seedUser,
  seedCourse,
  seedLesson,
  type TestDb,
} from "../helpers";

let testDb: TestDb;

vi.mock("@/lib/db/db", () => ({
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

import { createPurchaseCheckoutSession } from "@/features/purchases/checkout";

describe("Email Receipts — Checkout Session Parameter Behavior", () => {
  let user: { id: string; email: string };
  let creator: { id: string };
  let course: { id: string; slug: string };

  beforeAll(async () => {
    testDb = await getTestDb();
  });

  beforeEach(async () => {
    await cleanDb(testDb);
    vi.clearAllMocks();

    user = await seedUser(testDb, { email: "learner@example.com" });
    creator = await seedUser(testDb, { email: "creator@example.com" });
    course = await seedCourse(testDb, {
      creatorId: creator.id,
      title: "Monograph 1",
      slug: "monograph-1",
      isPublished: true,
      priceCents: 4900,
    });
    await seedLesson(testDb, {
      courseId: course.id,
      title: "Lesson 1",
      slug: "lesson-1",
      orderIndex: 0,
      durationSeconds: 300,
    });

    mockStripeSessionsCreate.mockResolvedValue({
      id: "cs_test_receipt",
      url: "https://checkout.stripe.com/c/pay/cs_test_receipt",
    });
  });

  it("passes payment_intent_data.receipt_email when a valid user email is present", async () => {
    await createPurchaseCheckoutSession({
      userId: user.id,
      userEmail: "learner@example.com",
      courseId: course.id,
      successUrl: "https://cursusaurus.com/success",
      cancelUrl: "https://cursusaurus.com/cancel",
    });

    expect(mockStripeSessionsCreate).toHaveBeenCalledTimes(1);
    const callArgs = mockStripeSessionsCreate.mock.calls[0][0];

    expect(callArgs.payment_intent_data).toBeDefined();
    expect(callArgs.payment_intent_data.receipt_email).toBe("learner@example.com");
  });

  it("completely omits payment_intent_data and receipt_email when userEmail is undefined", async () => {
    await createPurchaseCheckoutSession({
      userId: user.id,
      courseId: course.id,
      successUrl: "https://cursusaurus.com/success",
      cancelUrl: "https://cursusaurus.com/cancel",
    });

    expect(mockStripeSessionsCreate).toHaveBeenCalledTimes(1);
    const callArgs = mockStripeSessionsCreate.mock.calls[0][0];

    // receipt_email must NOT be present in callArgs or payment_intent_data
    expect(callArgs.payment_intent_data).toBeUndefined();
  });
});
