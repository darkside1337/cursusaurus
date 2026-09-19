import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import {
  getTestDb,
  cleanDb,
  seedUser,
  seedCourse,
  seedLesson,
  type TestDb,
} from "../helpers";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  listPublishedCourses,
  getCourseWithLessons,
} from "@/features/courses";
import { CourseCard } from "@/components/course-card";
import { CatalogGridSkeleton, filterCatalogCourses } from "@/app/(marketplace)/catalog-content";

let testDb: TestDb;

vi.mock("@/lib/db/db", () => ({
  get db() {
    return testDb;
  },
}));

describe("Chunk 2.4 — Public Catalog Experience", () => {
  let creator1: { id: string; name: string };
  let creator2: { id: string; name: string };

  beforeAll(async () => {
    testDb = await getTestDb();
  });

  beforeEach(async () => {
    await cleanDb(testDb);

    creator1 = await seedUser(testDb, { name: "Alice Masterclass" });
    creator2 = await seedUser(testDb, { name: "Bob Craft" });
  });

  describe("listPublishedCourses", () => {
    it("returns only published courses and excludes draft courses", async () => {
      const pubCourse = await seedCourse(testDb, {
        creatorId: creator1.id,
        title: "Published Graphic Monograph",
        isPublished: true,
        category: "Design",
      });

      const draftCourse = await seedCourse(testDb, {
        creatorId: creator1.id,
        title: "Draft Typography Manuscript",
        isPublished: false,
        category: "Design",
      });

      const catalog = await listPublishedCourses();
      expect(catalog).toHaveLength(1);
      expect(catalog[0].id).toBe(pubCourse.id);
      expect(catalog.some((c) => c.id === draftCourse.id)).toBe(false);
    });

    it("enriches catalog items with creatorName, lesson count, duration, and readiness", async () => {
      const course = await seedCourse(testDb, {
        creatorId: creator1.id,
        title: "Systems Architecture",
        isPublished: true,
        category: "Code",
      });

      await seedLesson(testDb, {
        courseId: course.id,
        title: "Module 1",
        durationSeconds: 600,
        orderIndex: 0,
      });
      await seedLesson(testDb, {
        courseId: course.id,
        title: "Module 2",
        durationSeconds: 1200,
        orderIndex: 1,
      });

      const [item] = await listPublishedCourses();
      expect(item.id).toBe(course.id);
      expect(item.creatorName).toBe("Alice Masterclass");
      expect(item.lessonCount).toBe(2);
      expect(item.totalDurationSeconds).toBe(1800);
      expect(item.readiness.isPurchaseEligible).toBe(true);
      expect(item.readiness.status).toBe("ready");
    });

    it("keeps published courses without video uploads discoverable in the catalog", async () => {
      const emptyCourse = await seedCourse(testDb, {
        creatorId: creator2.id,
        title: "Future of Film",
        isPublished: true,
        category: "Photography",
      });

      const catalog = await listPublishedCourses();
      const found = catalog.find((c) => c.id === emptyCourse.id);
      expect(found).toBeDefined();
      expect(found?.lessonCount).toBe(0);
      expect(found?.readiness.status).toBe("no_lessons");
      expect(found?.readiness.isPurchaseEligible).toBe(false);
    });

    it("client-side category filter narrows published catalog", async () => {
      const design = await seedCourse(testDb, {
        creatorId: creator1.id,
        title: "Design Systems Masterclass",
        isPublished: true,
        category: "Design",
      });
      const code = await seedCourse(testDb, {
        creatorId: creator2.id,
        title: "TypeScript Deep Dive",
        isPublished: true,
        category: "Code",
      });
      const marketing = await seedCourse(testDb, {
        creatorId: creator1.id,
        title: "Product Marketing Foundations",
        isPublished: true,
        category: "Marketing",
      });

      const catalog = await listPublishedCourses();

      const designOnly = filterCatalogCourses(catalog, "Design", "");
      expect(designOnly.map((c) => c.id)).toEqual([design.id]);

      const codeOnly = filterCatalogCourses(catalog, "Code", "");
      expect(codeOnly.map((c) => c.id)).toEqual([code.id]);

      const allCourses = filterCatalogCourses(catalog, "All", "");
      expect(allCourses).toHaveLength(3);
      const noMatch = filterCatalogCourses(catalog, "Photography", "");
      expect(noMatch).toHaveLength(0);
      expect(marketing.id).toBeDefined();
    });

    it("client-side search filter matches title, description, creator, and category", async () => {
      const typography = await seedCourse(testDb, {
        creatorId: creator1.id,
        title: "Architectural Principles in Typography",
        description: "A comprehensive monograph on font geometries.",
        isPublished: true,
        category: "Design",
      });
      const compiler = await seedCourse(testDb, {
        creatorId: creator2.id,
        title: "Compiler Construction in Rust",
        description: "Building ASTs and bytecodes from scratch.",
        isPublished: true,
        category: "Code",
      });

      const catalog = await listPublishedCourses();

      const searchTitle = filterCatalogCourses(catalog, "All", "typography");
      expect(searchTitle.map((c) => c.id)).toEqual([typography.id]);

      const searchDesc = filterCatalogCourses(catalog, "All", "bytecode");
      expect(searchDesc.map((c) => c.id)).toEqual([compiler.id]);

      const searchCreator = filterCatalogCourses(catalog, "All", "alice");
      expect(searchCreator.every((c) => c.creatorName === "Alice Masterclass")).toBe(true);

      const searchCategory = filterCatalogCourses(catalog, "All", "code");
      expect(searchCategory.map((c) => c.id)).toEqual([compiler.id]);

      const searchNone = filterCatalogCourses(catalog, "All", "nonexistent keyword");
      expect(searchNone).toHaveLength(0);
    });
  });

  describe("getCourseWithLessons by slug", () => {
    it("returns the course with creatorName, lessons ordered by orderIndex, and readiness", async () => {
      const course = await seedCourse(testDb, {
        creatorId: creator1.id,
        title: "The Editorial Craft",
        slug: "editorial-craft",
        isPublished: true,
        category: "Writing",
      });

      await seedLesson(testDb, {
        courseId: course.id,
        title: "Lesson Two",
        orderIndex: 1,
        durationSeconds: 400,
      });
      await seedLesson(testDb, {
        courseId: course.id,
        title: "Lesson One",
        orderIndex: 0,
        durationSeconds: 300,
      });

      const fetched = await getCourseWithLessons("editorial-craft");
      expect(fetched).not.toBeNull();
      expect(fetched?.id).toBe(course.id);
      expect(fetched?.creatorName).toBe("Alice Masterclass");
      expect(fetched?.lessons).toHaveLength(2);
      expect(fetched?.lessons[0].title).toBe("Lesson One");
      expect(fetched?.lessons[1].title).toBe("Lesson Two");
      expect(fetched?.readiness.totalDurationSeconds).toBe(700);
      expect(fetched?.readiness.status).toBe("ready");
    });

    it("returns null for non-existent slug", async () => {
      const result = await getCourseWithLessons("does-not-exist");
      expect(result).toBeNull();
    });
  });

  describe("CourseCard Presentation & Access-State Discipline", () => {
    const mockCourse = {
      id: "course-123",
      title: "Monograph Form & Typographic Space",
      slug: "monograph-form",
      description: "An intensive study of layout proportions.",
      category: "Design",
      thumbnailUrl: "https://example.com/thumb.jpg",
      priceCents: 4900,
      creatorId: "user-123",
      creatorName: "Julian Vance",
      isPublished: true,
      lessonCount: 5,
      totalDurationSeconds: 3600,
      createdAt: new Date(),
      updatedAt: new Date(),
      readiness: {
        isPublished: true,
        isPurchaseEligible: true,
        status: "ready" as const,
        lessonCount: 5,
        totalDurationSeconds: 3600,
      },
    };

    it("does NOT display All-Access badge when accessState is 'none'", () => {
      const html = renderToStaticMarkup(
        React.createElement(CourseCard, {
          course: mockCourse,
          accessState: "none",
        })
      );

      // Invariant: Blush Peach is reserved for access-state signaling only
      expect(html).not.toContain("All-Access");
      expect(html).not.toContain("bg-blush-peach");
      expect(html).toContain("$49");
      expect(html).toContain("Julian Vance");
      expect(html).toContain("/monograph-form");
    });

    it("displays All-Access badge and 'Included with Pass' when accessState is 'all-access'", () => {
      const html = renderToStaticMarkup(
        React.createElement(CourseCard, {
          course: mockCourse,
          accessState: "all-access",
        })
      );

      expect(html).toContain("All-Access");
      expect(html).toContain("Included");
    });

    it("displays Purchased badge and 'Enrolled' when accessState is 'purchased'", () => {
      const html = renderToStaticMarkup(
        React.createElement(CourseCard, {
          course: mockCourse,
          accessState: "purchased",
        })
      );

      expect(html).toContain("Purchased");
      expect(html).toContain("Enrolled");
    });

    it("displays Coming Soon badge when course has 0 lessons", () => {
      const comingSoonCourse = {
        ...mockCourse,
        lessonCount: 0,
        totalDurationSeconds: 0,
        readiness: {
          ...mockCourse.readiness,
          isPurchaseEligible: false,
          status: "no_lessons" as const,
          lessonCount: 0,
          totalDurationSeconds: 0,
        },
      };

      const html = renderToStaticMarkup(
        React.createElement(CourseCard, {
          course: comingSoonCourse,
          accessState: "none",
        })
      );

      expect(html).toContain("Coming Soon");
      expect(html).toContain("Coming soon");
      expect(html).not.toContain("All-Access");
    });

    it("renders CatalogGridSkeleton without errors", () => {
      const html = renderToStaticMarkup(
        React.createElement(CatalogGridSkeleton)
      );
      expect(html).toContain('data-slot="catalog-skeleton-grid"');
      expect(html).toContain('data-slot="skeleton"');
    });
  });
});
