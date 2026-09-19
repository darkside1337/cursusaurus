ALTER TABLE "lessons" ADD COLUMN "video_key" text;
--> statement-breakpoint
ALTER TABLE "lesson_progress" DROP COLUMN IF EXISTS "lesson_slug";
--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_progress_user_lesson_idx" ON "lesson_progress" USING btree ("user_id","lesson_id");
--> statement-breakpoint
CREATE INDEX "lesson_progress_user_course_idx" ON "lesson_progress" USING btree ("user_id","course_id");
