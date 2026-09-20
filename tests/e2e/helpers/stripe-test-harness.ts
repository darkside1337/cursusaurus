import { stripe } from "@/lib/stripe";
import { env } from "@/config/env";

export interface SendWebhookOptions {
  eventId?: string;
  createdEpoch?: number;
  invalidSignature?: boolean;
  missingSignature?: boolean;
  baseUrl?: string;
}

export function createStripeEventPayload(
  type: string,
  dataObject: object,
  options?: { eventId?: string; createdEpoch?: number }
) {
  return {
    id: options?.eventId || `evt_test_${crypto.randomUUID().slice(0, 12)}`,
    object: "event",
    api_version: "2024-12-18.acacia",
    created: options?.createdEpoch || Math.floor(Date.now() / 1000),
    type,
    data: {
      object: dataObject,
    },
  };
}

export async function postWebhookEvent(
  event: object,
  options?: SendWebhookOptions
): Promise<Response> {
  const baseUrl = options?.baseUrl || process.env.PLAYWRIGHT_TEST_BASE_URL || "http://localhost:3000";
  const url = `${baseUrl.replace(/\/$/, "")}/api/webhooks/stripe`;
  const rawBody = JSON.stringify(event);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (!options?.missingSignature) {
    if (options?.invalidSignature) {
      headers["stripe-signature"] = "t=1234567890,v1=invalidsignaturebadhash";
    } else {
      const secret = env.STRIPE_WEBHOOK_SECRET || "whsec_test";
      const sig = stripe.webhooks.generateTestHeaderString({
        payload: rawBody,
        secret,
      });
      headers["stripe-signature"] = sig;
    }
  }

  return fetch(url, {
    method: "POST",
    headers,
    body: rawBody,
  });
}
