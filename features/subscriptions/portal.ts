import { stripe } from "@/lib/stripe";
import { createCustomerPortalSchema } from "./schemas";
import type { CreateCustomerPortalInput } from "./types";

export async function createCustomerPortalSession(
  input: CreateCustomerPortalInput
): Promise<{ url: string }> {
  const validated = createCustomerPortalSchema.parse(input);

  const session = await stripe.billingPortal.sessions.create({
    customer: validated.customerId,
    return_url: validated.returnUrl,
  });

  return { url: session.url };
}
