import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { env } from "@/config/env";
import { dispatchStripeEvent } from "@/features/stripe/dispatch";

export async function POST(req: Request) {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    console.error("STRIPE_WEBHOOK_SECRET is not configured");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  let event;
  try {
    const rawBody = await req.text();
    event = stripe.webhooks.constructEvent(rawBody, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json(
      { error: "Webhook signature verification failed" },
      { status: 400 }
    );
  }

  try {
    const result = await dispatchStripeEvent(event);
    return NextResponse.json({ received: true, ...result });
  } catch (err) {
    console.error("Error processing Stripe webhook event:", event.id, err);
    return NextResponse.json(
      { error: "Internal error processing webhook" },
      { status: 500 }
    );
  }
}
