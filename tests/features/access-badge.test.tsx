import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getTestDb, cleanDb, seedUser, seedCourse, seedEntitlement, type TestDb } from "../helpers";
import {
  resolveCourseAccessState,
  resolveUserCoursesAccessMap,
} from "@/features/entitlements/access";
import { AccessBadge } from "@/components/access-badge";
import { CourseCard } from "@/components/course-card";
import type { CatalogCourseItem } from "@/features/courses";

let testDb: TestDb;

vi.mock("@/lib/db/db", () => ({
  get db() {
    return testDb;
  },
}));

describe("Access Badge & Entitlement Resolver (Core 5-Case Truth Table)", () => {
  let user: { id: string };
  let courseA: { id: string };
  let courseB: { id: string };

  beforeAll(async () => {
    testDb = await getTestDb();
  });

  beforeEach(async () => {
    await cleanDb(testDb);
    user = await seedUser(testDb, { name: "Learner One" });
    courseA = await seedCourse(testDb, { title: "Course Alpha" });
    courseB = await seedCourse(testDb, { title: "Course Beta" });
  });

  it("Case 1: Unentitled learner resolves to 'locked'", async () => {
    const state = await resolveCourseAccessState(user.id, courseA.id);
    expect(state).toBe("locked");

    const map = await resolveUserCoursesAccessMap(user.id, [courseA.id, courseB.id]);
    expect(map.get(courseA.id)).toBe("locked");
    expect(map.get(courseB.id)).toBe("locked");
  });

  it("Case 2: Standalone course owner resolves to 'purchased'", async () => {
    await seedEntitlement(testDb, {
      userId: user.id,
      courseId: courseA.id,
      source: "purchase",
      revokedAt: null,
    });

    const stateA = await resolveCourseAccessState(user.id, courseA.id);
    const stateB = await resolveCourseAccessState(user.id, courseB.id);

    expect(stateA).toBe("purchased");
    expect(stateB).toBe("locked");
  });

  it("Case 3: All-Access subscriber resolves to 'all-access'", async () => {
    await seedEntitlement(testDb, {
      userId: user.id,
      courseId: null,
      source: "subscription",
      revokedAt: null,
    });

    const map = await resolveUserCoursesAccessMap(user.id, [courseA.id, courseB.id]);
    expect(map.get(courseA.id)).toBe("all-access");
    expect(map.get(courseB.id)).toBe("all-access");
  });

  it("Case 4: Dual entitlement (standalone purchase + All-Access) gives precedence to 'purchased'", async () => {
    // User owns Course A perpetual license AND has active All-Access
    await seedEntitlement(testDb, {
      userId: user.id,
      courseId: courseA.id,
      source: "purchase",
      revokedAt: null,
    });
    await seedEntitlement(testDb, {
      userId: user.id,
      courseId: null,
      source: "subscription",
      revokedAt: null,
    });

    const map = await resolveUserCoursesAccessMap(user.id, [courseA.id, courseB.id]);
    expect(map.get(courseA.id)).toBe("purchased");
    expect(map.get(courseB.id)).toBe("all-access");
  });

  it("Case 5: Standalone purchase remains 'purchased' when subscription lapses (Invariant #4)", async () => {
    // User owns Course A, but subscription was revoked
    await seedEntitlement(testDb, {
      userId: user.id,
      courseId: courseA.id,
      source: "purchase",
      revokedAt: null,
    });
    await seedEntitlement(testDb, {
      userId: user.id,
      courseId: null,
      source: "subscription",
      revokedAt: new Date(),
    });

    const map = await resolveUserCoursesAccessMap(user.id, [courseA.id, courseB.id]);
    expect(map.get(courseA.id)).toBe("purchased");
    expect(map.get(courseB.id)).toBe("locked");
  });

  it("Single SQL Query handles empty courseIds array without error", async () => {
    const map = await resolveUserCoursesAccessMap(user.id, []);
    expect(map.size).toBe(0);
  });
});

describe("<AccessBadge> Component Rendering", () => {
  it("renders 'Purchased' variant", () => {
    const html = renderToStaticMarkup(<AccessBadge state="purchased" />);
    expect(html).toContain("Purchased");
  });

  it("renders 'All-Access' variant", () => {
    const html = renderToStaticMarkup(<AccessBadge state="all-access" />);
    expect(html).toContain("All-Access");
  });

  it("renders 'Locked' variant with lock icon by default", () => {
    const html = renderToStaticMarkup(<AccessBadge state="locked" />);
    expect(html).toContain("Locked");
    expect(html).toContain("<svg");
  });

  it("renders 'Locked' variant without icon if showIcon is false", () => {
    const html = renderToStaticMarkup(<AccessBadge state="locked" showIcon={false} />);
    expect(html).toContain("Locked");
    expect(html).not.toContain("<svg");
  });
});

describe("Availability Precedence Rule in <CourseCard>", () => {
  const baseCourse: CatalogCourseItem = {
    id: "c-1",
    creatorId: "user-1",
    title: "Editorial Design Mastery",
    slug: "editorial-design",
    description: "Learn editorial design.",
    category: "Design",
    priceCents: 4900,
    isPublished: true,
    thumbnailUrl: null,
    totalDurationSeconds: 3600,
    lessonCount: 0, // Coming soon
    creatorName: "Prof. Typo",
    createdAt: new Date(),
    updatedAt: new Date(),
    readiness: {
      isPublished: true,
      isPurchaseEligible: false,
      status: "no_lessons",
      lessonCount: 0,
      totalDurationSeconds: 0,
    },
  };

  it("renders 'Coming Soon' badge and suppresses 'Purchased' badge when lessonCount === 0", () => {
    const html = renderToStaticMarkup(
      <CourseCard course={baseCourse} accessState="purchased" />
    );
    expect(html).toContain("Coming Soon");
    expect(html).not.toContain("Purchased");
  });

  it("renders 'AccessBadge' when course has lessons (lessonCount > 0)", () => {
    const readyCourse: CatalogCourseItem = {
      ...baseCourse,
      lessonCount: 5,
    };
    const html = renderToStaticMarkup(
      <CourseCard course={readyCourse} accessState="all-access" />
    );
    expect(html).toContain("All-Access");
    expect(html).not.toContain("Coming Soon");
  });
});
