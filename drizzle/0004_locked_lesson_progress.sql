UPDATE "lesson_progress" SET "lesson_id" = "lessons"."id"
FROM "lessons"
WHERE "lesson_progress"."lesson_id" IS NULL
  AND "lesson_progress"."lesson_slug" = "lessons"."slug"
  AND "lesson_progress"."course_id" = "lessons"."course_id";
--> statement-breakpoint
ALTER TABLE "lesson_progress" ALTER COLUMN "lesson_id" SET NOT NULL;
