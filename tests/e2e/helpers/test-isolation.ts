import { db } from "@/lib/db/db";
import * as schema from "@/lib/db/schema";
import { getSessionCookies, type SessionCookies } from "@/tests/helpers/auth";

export interface IsolatedUser {
  id: string;
  name: string;
  email: string;
  cookies: SessionCookies;
}

export interface IsolatedCourse {
  id: string;
  title: string;
  slug: string;
  creatorId: string;
  lessons: Array<{
    id: string;
    title: string;
    slug: string;
    isPreview: boolean;
    videoKey: string | null;
  }>;
}

/**
 * Creates an isolated user in the real database and mints valid Better Auth session cookies.
 */
export async function createIsolatedUser(
  role: "learner" | "creator" = "learner",
  nameSuffix?: string
): Promise<IsolatedUser> {
  const uuid = crypto.randomUUID().slice(0, 8);
  const name = `${role === "creator" ? "Creator" : "Learner"} ${nameSuffix ?? uuid}`;
  const email = `test-${role}-${uuid}@cursusaurus.test`;

  const [created] = await db
    .insert(schema.user)
    .values({
      id: `test-usr-${uuid}`,
      name,
      email,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  const cookies = await getSessionCookies(created.id);

  return {
    id: created.id,
    name: created.name,
    email: created.email,
    cookies,
  };
}

/**
 * Creates an isolated course with 2 lessons in the real database.
 */
export async function createIsolatedCourse(
  creatorId: string,
  overrides?: Partial<typeof schema.courses.$inferInsert>
): Promise<IsolatedCourse> {
  const uuid = crypto.randomUUID().slice(0, 8);
  const slug = `test-course-${uuid}`;

  const [course] = await db
    .insert(schema.courses)
    .values({
      id: `test-crs-${uuid}`,
      title: `Test Monograph ${uuid}`,
      slug,
      description: "Isolated automated test course monograph.",
      category: "Code",
      priceCents: 4900,
      isPublished: true,
      creatorId,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    })
    .returning();

  // Seed Lesson 1: Free Preview
  const [lesson1] = await db
    .insert(schema.lessons)
    .values({
      id: `test-lsn-${uuid}-01`,
      courseId: course.id,
      title: "First Foundations (Preview)",
      slug: "first-foundations",
      orderIndex: 0,
      durationSeconds: 180,
      videoKey: "seed-course-ts/seed-lesson-ts-01.mp4",
      isPreview: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  // Seed Lesson 2: Paid Monograph
  const [lesson2] = await db
    .insert(schema.lessons)
    .values({
      id: `test-lsn-${uuid}-02`,
      courseId: course.id,
      title: "Advanced Systems (Gated)",
      slug: "advanced-systems",
      orderIndex: 1,
      durationSeconds: 240,
      videoKey: "seed-course-ts/seed-lesson-ts-02.mp4",
      isPreview: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return {
    id: course.id,
    title: course.title,
    slug: course.slug,
    creatorId: course.creatorId,
    lessons: [
      {
        id: lesson1.id,
        title: lesson1.title,
        slug: lesson1.slug,
        isPreview: lesson1.isPreview,
        videoKey: lesson1.videoKey,
      },
      {
        id: lesson2.id,
        title: lesson2.title,
        slug: lesson2.slug,
        isPreview: lesson2.isPreview,
        videoKey: lesson2.videoKey,
      },
    ],
  };
}
