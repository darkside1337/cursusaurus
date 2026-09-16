import { db } from "@/lib/db";
import { courses, entitlements, lessons } from "@/db/schema";
import { user } from "@/lib/db/schema/auth-schema";

async function seed() {
  console.log("Seeding dev database…");

  await db
    .insert(user)
    .values({
      id: "seed-learner-01",
      name: "Alice Learner",
      email: "learner@example.com",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoNothing();

  await db
    .insert(user)
    .values({
      id: "seed-creator-01",
      name: "Bob Creator",
      email: "creator@example.com",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoNothing();

  await db
    .insert(courses)
    .values({
      id: "seed-course-ts",
      title: "Introduction to TypeScript",
      slug: "intro-to-typescript",
      description: "A practical intro to TypeScript from first principles.",
      priceCents: 4900,
      isPublished: true,
      creatorId: "seed-creator-01",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoNothing();

  await db
    .insert(courses)
    .values({
      id: "seed-course-next",
      title: "Advanced Next.js",
      slug: "advanced-nextjs",
      description: "Deep dive into App Router, caching, and Server Actions.",
      priceCents: 9900,
      isPublished: true,
      creatorId: "seed-creator-01",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoNothing();

  await db
    .insert(lessons)
    .values([
      {
        id: "seed-lesson-ts-01",
        courseId: "seed-course-ts",
        title: "The Type System Foundation",
        slug: "type-system-foundation",
        description: "Understanding structural typing and primitives.",
        orderIndex: 0,
        durationSeconds: 1125, // 18m 45s
        isPreview: true,
      },
      {
        id: "seed-lesson-ts-02",
        courseId: "seed-course-ts",
        title: "Generics and Constraints",
        slug: "generics-and-constraints",
        description: "Building flexible, reusable type contracts.",
        orderIndex: 1,
        durationSeconds: 1452, // 24m 12s
        isPreview: false,
      },
      {
        id: "seed-lesson-ts-03",
        courseId: "seed-course-ts",
        title: "Conditional and Mapped Types",
        slug: "conditional-and-mapped-types",
        description: "Advanced type transformations for domain modeling.",
        orderIndex: 2,
        durationSeconds: 908, // 15m 08s
        isPreview: false,
      },
      {
        id: "seed-lesson-next-01",
        courseId: "seed-course-next",
        title: "Server Components & Suspense Architecture",
        slug: "rsc-suspense-architecture",
        description: "Deep dive into React 19 Server Components.",
        orderIndex: 0,
        durationSeconds: 1840,
        isPreview: true,
      },
    ])
    .onConflictDoNothing();

  // Purchase-scoped entitlement: learner owns intro-to-typescript
  await db
    .insert(entitlements)
    .values({
      id: "seed-ent-purchase-01",
      userId: "seed-learner-01",
      courseId: "seed-course-ts",
      source: "purchase",
      grantedAt: new Date(),
      revokedAt: null,
    })
    .onConflictDoNothing();

  // All-access subscription entitlement (course_id = null)
  await db
    .insert(entitlements)
    .values({
      id: "seed-ent-sub-01",
      userId: "seed-learner-01",
      courseId: null,
      source: "subscription",
      grantedAt: new Date(),
      revokedAt: null,
    })
    .onConflictDoNothing();

  console.log("Done. Seeded 2 users, 2 courses, 2 entitlements.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
