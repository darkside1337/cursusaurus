import * as schema from "@/db/schema";
import type { TestDb } from "./db";

export async function seedUser(
  db: TestDb,
  overrides?: Partial<typeof schema.user.$inferInsert>
) {
  const [row] = await db
    .insert(schema.user)
    .values({
      id: crypto.randomUUID(),
      name: "Test User",
      email: `user-${crypto.randomUUID()}@test.com`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    })
    .returning();
  return row;
}

export async function seedCourse(
  db: TestDb,
  overrides?: Partial<typeof schema.courses.$inferInsert>
) {
  let creatorId = overrides?.creatorId;
  if (!creatorId) {
    const creator = await seedUser(db, { name: "Default Test Creator" });
    creatorId = creator.id;
  }

  const [row] = await db
    .insert(schema.courses)
    .values({
      id: crypto.randomUUID(),
      title: "Test Course",
      slug: `test-course-${crypto.randomUUID()}`,
      priceCents: 4900,
      isPublished: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
      creatorId,
    })
    .returning();
  return row;
}

export async function seedEntitlement(
  db: TestDb,
  input: {
    userId: string;
    courseId?: string | null;
    source: "purchase" | "subscription" | "admin_grant";
    revokedAt?: Date | null;
  }
) {
  const [row] = await db
    .insert(schema.entitlements)
    .values({
      id: crypto.randomUUID(),
      userId: input.userId,
      courseId: input.courseId ?? null,
      source: input.source,
      grantedAt: new Date(),
      revokedAt: input.revokedAt ?? null,
    })
    .returning();
  return row;
}
