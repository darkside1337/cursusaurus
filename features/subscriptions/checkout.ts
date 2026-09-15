import { stripe } from "@/lib/stripe";
import { createSubscriptionCheckoutSchema } from "./schemas";
import type { CreateSubscriptionCheckoutInput } from "./types";

export async function createSubscriptionCheckoutSession(
  input: CreateSubscriptionCheckoutInput
): Promise<{ sessionId: string; url: string }> {
  const validated = createSubscriptionCheckoutSchema.parse(input);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    customer_email: validated.customerEmail,
    line_items: [
      {
        price: validated.priceId,
        quantity: 1,
      },
    ],
    subscription_data: {
      // Per PRD §8: 7-day free trial on All-Access
      trial_period_days: 7,
      metadata: {
        userId: validated.userId,
        subscriptionType: "all_access",
      },
    },
    metadata: {
      userId: validated.userId,
      subscriptionType: "all_access",
    },
    client_reference_id: validated.userId,
    success_url: validated.successUrl,
    cancel_url: validated.cancelUrl,
  });

  if (!session.url) {
    throw new Error("Failed to create Stripe subscription checkout session URL");
  }

  return {
    sessionId: session.id,
    url: session.url,
  };
}
