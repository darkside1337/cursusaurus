import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createSubscriptionCheckoutSchema } from "./schemas";
import {
  ALL_ACCESS_PRICE_CENTS,
  ALL_ACCESS_TRIAL_DAYS,
  ALL_ACCESS_PRICE_ID,
} from "./pricing";
import type { CreateSubscriptionCheckoutInput } from "./types";

export async function createSubscriptionCheckoutSession(
  input: CreateSubscriptionCheckoutInput
): Promise<{ sessionId: string; url: string }> {
  const validated = createSubscriptionCheckoutSchema.parse(input);

  const priceId = ALL_ACCESS_PRICE_ID;

  const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = priceId
    ? {
        price: priceId,
        quantity: 1,
      }
    : {
        price_data: {
          currency: "usd",
          product_data: {
            name: "All-Access Pass",
            description: "Unlimited access to every course monograph in Cursusaurus",
          },
          unit_amount: ALL_ACCESS_PRICE_CENTS,
          recurring: {
            interval: "month",
          },
        },
        quantity: 1,
      };

  const customerParams: Partial<Stripe.Checkout.SessionCreateParams> = {};
  if (validated.stripeCustomerId) {
    customerParams.customer = validated.stripeCustomerId;
  } else if (validated.customerEmail) {
    customerParams.customer_email = validated.customerEmail;
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    ...customerParams,
    line_items: [lineItem],
    subscription_data: {
      ...(validated.hasUsedTrial ? {} : { trial_period_days: ALL_ACCESS_TRIAL_DAYS }),
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
