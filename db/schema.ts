import { pgTable, text, timestamp, boolean, integer, bigint, index, unique, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { user } from "@/lib/db/schema/auth-schema";

export * from "@/lib/db/schema/auth-schema";

export const courses = pgTable("courses", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  category: text("category").default("Design").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  priceCents: integer("price_cents").notNull(),
  isPublished: boolean("is_published").default(false).notNull(),
  creatorId: text("creator_id")
    .notNull()
    .references(() => user.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .$onUpdate(() => new Date())
    .notNull(),
});

export const lessons = pgTable(
  "lessons",
  {
    id: text("id").primaryKey(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    orderIndex: integer("order_index").notNull(),
    durationSeconds: integer("duration_seconds"),
    isPreview: boolean("is_preview").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique("lessons_course_id_slug_unique").on(table.courseId, table.slug),
    index("lessons_course_order_idx").on(table.courseId, table.orderIndex),
  ]
);

export const purchases = pgTable("purchases", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  courseId: text("course_id")
    .notNull()
    .references(() => courses.id),
  stripePaymentIntentId: text("stripe_payment_intent_id").notNull().unique(),
  stripeSessionId: text("stripe_session_id").unique(),
  pricePaidCents: integer("price_paid_cents"),
  status: text("status").notNull(),
  purchasedAt: timestamp("purchased_at").defaultNow().notNull(),
});

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    stripeSubscriptionId: text("stripe_subscription_id").notNull().unique(),
    stripeCustomerId: text("stripe_customer_id").notNull(),
    stripeSessionId: text("stripe_session_id"),
    status: text("status").notNull(),
    currentPeriodEnd: timestamp("current_period_end").notNull(),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
    trialEndsAt: timestamp("trial_ends_at"),
    lastEventEpoch: bigint("last_event_epoch", { mode: "number" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("subscriptions_stripe_session_id_idx").on(table.stripeSessionId),
    uniqueIndex("subscriptions_one_active_user").on(table.userId).where(
      sql`${table.status} IN ('trialing','active')`
    ),
  ]
);

export const entitlements = pgTable(
  "entitlements",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    courseId: text("course_id").references(() => courses.id),
    source: text("source").notNull(),
    grantedAt: timestamp("granted_at").defaultNow().notNull(),
    revokedAt: timestamp("revoked_at"),
  },
  (table) => [
    index("entitlements_user_active_idx").on(table.userId, table.revokedAt),
  ]
);

export const lessonProgress = pgTable("lesson_progress", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  courseId: text("course_id")
    .notNull()
    .references(() => courses.id),
  lessonId: text("lesson_id")
    .notNull()
    .references(() => lessons.id),
  lessonSlug: text("lesson_slug").notNull(),
  completed: boolean("completed").default(false).notNull(),
  lastPositionSeconds: integer("last_position_seconds").default(0).notNull(),
  updatedAt: timestamp("updated_at")
    .$onUpdate(() => new Date())
    .notNull(),
});

export const processedStripeEvents = pgTable("processed_stripe_events", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().unique(),
  eventType: text("event_type").notNull(),
  processedAt: timestamp("processed_at").defaultNow().notNull(),
});

export const reconcileAttempts = pgTable("reconcile_attempts", {
  stripeSessionId: text("stripe_session_id").primaryKey(),
  userId: text("user_id").references(() => user.id),
  status: text("status").notNull().default("processing"),
  error: text("error"),
  attemptedAt: timestamp("attempted_at").defaultNow().notNull(),
});

export const refundTombstones = pgTable("refund_tombstones", {
  stripePaymentIntentId: text("stripe_payment_intent_id").primaryKey(),
  refundedAt: timestamp("refunded_at").defaultNow().notNull(),
});
