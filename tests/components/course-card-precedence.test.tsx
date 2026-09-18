import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CourseCard } from "@/components/course-card";
import type { CatalogCourseItem } from "@/features/courses";

describe("P2-3: CourseCard Coming Soon Badge Precedence", () => {
  const baseCourse: CatalogCourseItem = {
    id: "c1",
    title: "Upcoming TypeScript Mastery",
    slug: "upcoming-ts",
    description: "An upcoming course",
    category: "Design",
    thumbnailUrl: null,
    priceCents: 4900,
    creatorName: "Test Creator",
    creatorId: "u1",
    lessonCount: 0,
    totalDurationSeconds: 0,
    isPublished: true,
    readiness: {
      status: "no_lessons",
      isPublished: true,
      isPurchaseEligible: false,
      lessonCount: 0,
      totalDurationSeconds: 0,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("renders 'Coming Soon' badge when lessonCount is 0 even if accessState is all-access", () => {
    const html = renderToStaticMarkup(
      <CourseCard course={baseCourse} accessState="all-access" />
    );

    expect(html).toContain("Coming Soon");
    expect(html).toContain("Coming soon"); // bottom strip
    expect(html).not.toContain("All-Access");
    expect(html).not.toContain("Included");
  });

  it("renders 'All-Access' and 'Included' when lessonCount > 0 and accessState is all-access", () => {
    const publishedCourseWithLessons: CatalogCourseItem = {
      ...baseCourse,
      lessonCount: 5,
      totalDurationSeconds: 1800,
    };

    const html = renderToStaticMarkup(
      <CourseCard course={publishedCourseWithLessons} accessState="all-access" />
    );

    expect(html).toContain("All-Access");
    expect(html).toContain("Included");
    expect(html).not.toContain("Coming Soon");
  });

  it("renders 'Purchased' badge when accessState is purchased and course has lessons", () => {
    const publishedCourseWithLessons: CatalogCourseItem = {
      ...baseCourse,
      lessonCount: 3,
      totalDurationSeconds: 900,
    };

    const html = renderToStaticMarkup(
      <CourseCard course={publishedCourseWithLessons} accessState="purchased" />
    );

    expect(html).toContain("Purchased");
    expect(html).toContain("Enrolled • Continue");
  });
});
