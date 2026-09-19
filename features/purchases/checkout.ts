import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { getCourseById, getCourseReadiness } from "@/features/courses/queries";
import { createPurchaseCheckoutSchema } from "./schemas";
import type { CreatePurchaseCheckoutInput } from "./types";

export async function createPurchaseCheckoutSession(
  input: CreatePurchaseCheckoutInput
): Promise<{ sessionId: string; url: string }> {
  const validated = createPurchaseCheckoutSchema.parse(input);

  const course = await getCourseById(validated.courseId);
  if (!course) {
    throw new Error(`Course not found: ${validated.courseId}`);
  }

  if (!course.isPublished) {
    throw new Error(`Course is not available for purchase: ${validated.courseId}`);
  }

  const readiness = await getCourseReadiness(course.id);
  if (!readiness || !readiness.isPurchaseEligible) {
    throw new Error(
      `Course does not meet purchase eligibility criteria: ${validated.courseId}`
    );
  }

  const customerParams: Partial<Stripe.Checkout.SessionCreateParams> = {};
  if (validated.stripeCustomerId) {
    customerParams.customer = validated.stripeCustomerId;
  } else if (validated.userEmail) {
    customerParams.customer_email = validated.userEmail;
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    ...customerParams,
    ...(validated.userEmail
      ? {
          payment_intent_data: {
            receipt_email: validated.userEmail,
          },
        }
      : {}),
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: course.title,
            description: course.description ?? undefined,
          },
          unit_amount: course.priceCents,
        },
        quantity: 1,
      },
    ],
    metadata: {
      userId: validated.userId,
      courseId: course.id,
      courseSlug: course.slug,
      purchaseType: "one_time",
    },
    client_reference_id: validated.userId,
    success_url: validated.successUrl,
    cancel_url: validated.cancelUrl,
  });

  if (!session.url) {
    throw new Error("Failed to create Stripe checkout session URL");
  }

  return {
    sessionId: session.id,
    url: session.url,
  };
}
