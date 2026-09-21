import { eq } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { processedStripeEvents } from "@/lib/db/schema";
import type { FulfillmentContext } from "./types";

type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Checks whether a Stripe event has already been processed (Invariant #7).
 */
export async function isEventAlreadyProcessed(
  tx: DbOrTx,
  eventId: string
): Promise<boolean> {
  const [alreadyProcessed] = await tx
    .select({ id: processedStripeEvents.id })
    .from(processedStripeEvents)
    .where(eq(processedStripeEvents.eventId, eventId))
    .limit(1);

  return Boolean(alreadyProcessed);
}

/**
 * Records a processed Stripe event to ensure webhook delivery idempotency.
 */
export async function recordProcessedEvent(
  tx: DbOrTx,
  ctx: FulfillmentContext
): Promise<void> {
  await tx
    .insert(processedStripeEvents)
    .values({
      id: crypto.randomUUID(),
      eventId: ctx.eventId,
      eventType: ctx.eventType,
    })
    .onConflictDoNothing();
}
