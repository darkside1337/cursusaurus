"use client";

import { useState, useRef, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Pencil,
  Trash2,
  Plus,
  Video,
  Clock,
  AlertTriangle,
  Loader2,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import type { Course, Lesson, CourseReadiness } from "@/features/courses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  updateCourseMetadataAction,
  toggleCoursePublishAction,
  createLessonAction,
  updateLessonAction,
  deleteLessonAction,
  reorderLessonsAction,
} from "./actions";

export const COURSE_CATEGORIES = [
  "Design",
  "Code",
  "Marketing",
  "Writing",
  "Business",
  "Photography",
] as const;

export type CourseCategory = (typeof COURSE_CATEGORIES)[number];

interface CurriculumStudioProps {
  initialCourse: Course & { readiness: CourseReadiness };
  initialLessons: Lesson[];
}

function formatDuration(totalSeconds: number | null | undefined): string {
  if (!totalSeconds || totalSeconds <= 0) return "0:00";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatCurriculumDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return "0m total";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.round((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m total`;
  }
  return `${minutes}m total`;
}

export function CurriculumStudio({ initialCourse, initialLessons }: CurriculumStudioProps) {
  const [course, setCourse] = useState(initialCourse);
  const [lessons, setLessons] = useState<Lesson[]>(initialLessons);

  // Server-confirmed lesson order; used to revert optimistic reorders on failure.
  const serverLessonsRef = useRef<Lesson[]>(initialLessons);

  // Metadata Form State
  const [title, setTitle] = useState(initialCourse.title);
  const [slug, setSlug] = useState(initialCourse.slug);
  const [description, setDescription] = useState(initialCourse.description ?? "");
  const [category, setCategory] = useState<string>(initialCourse.category ?? "Design");
  const [priceDollars, setPriceDollars] = useState(Math.round(initialCourse.priceCents / 100));
  const [thumbnailUrl, setThumbnailUrl] = useState(initialCourse.thumbnailUrl ?? "");

  // Dialog States
  const [lessonDialogOpen, setLessonDialogOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonSlug, setLessonSlug] = useState("");
  const [lessonDescription, setLessonDescription] = useState("");
  const [lessonMinutes, setLessonMinutes] = useState(0);
  const [lessonSeconds, setLessonSeconds] = useState(0);
  const [lessonIsPreview, setLessonIsPreview] = useState(false);

  // Delete Dialog State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingLesson, setDeletingLesson] = useState<Lesson | null>(null);

  const [isPending, startTransition] = useTransition();

  const totalDurationSeconds = lessons.reduce(
    (acc, l) => acc + (l.durationSeconds ?? 0),
    0
  );

  const isPublished = course.isPublished;
  const isPurchaseReady = isPublished && lessons.length >= 1;
  const isComingSoon = isPublished && lessons.length === 0;

  // Toggle Publication
  const handleTogglePublish = (nextPublished: boolean) => {
    startTransition(async () => {
      const res = await toggleCoursePublishAction(course.id, nextPublished);
      if (res.success && res.data) {
        setCourse((prev) => ({
          ...prev,
          isPublished: nextPublished,
          readiness: res.data!.readiness,
        }));
        toast.success(
          nextPublished
            ? lessons.length === 0
              ? "Course published as Coming Soon (add at least 1 lesson to enable purchasing)."
              : "Course published! It is now live in the catalog."
            : "Course unpublished and switched to draft mode."
        );
      } else {
        toast.error(res.error || "Failed to update publication status");
      }
    });
  };

  // Save Metadata
  const handleSaveMetadata = (e: React.FormEvent) => {
    e.preventDefault();

    if (priceDollars < 19 || priceDollars > 199) {
      toast.error(
        "Price must be constrained between $19 and $199 USD per PRD specifications."
      );
      return;
    }

    startTransition(async () => {
      const res = await updateCourseMetadataAction(course.id, {
        title,
        slug: slug.trim() || undefined,
        description,
        category,
        priceDollars,
        thumbnailUrl: thumbnailUrl.trim() || null,
      });

      if (res.success && res.data) {
        setCourse((prev) => ({
          ...prev,
          ...res.data!,
        }));
        setSlug(res.data.slug);
        setTitle(res.data.title);
        setDescription(res.data.description ?? "");
        setCategory(res.data.category ?? "Design");
        setPriceDollars(Math.round(res.data.priceCents / 100));
        setThumbnailUrl(res.data.thumbnailUrl ?? "");
        toast.success("Course metadata saved successfully.");
      } else {
        toast.error(res.error || "Failed to save course metadata", {
          description: "Your changes were not saved.",
        });
      }
    });
  };

  // Open Create Lesson Modal
  const handleOpenCreateLesson = () => {
    setEditingLesson(null);
    setLessonTitle("");
    setLessonSlug("");
    setLessonDescription("");
    setLessonMinutes(5);
    setLessonSeconds(0);
    setLessonIsPreview(lessons.length === 0); // Default first lesson as preview
    setLessonDialogOpen(true);
  };

  // Open Edit Lesson Modal
  const handleOpenEditLesson = (lesson: Lesson) => {
    setEditingLesson(lesson);
    setLessonTitle(lesson.title);
    setLessonSlug(lesson.slug);
    setLessonDescription(lesson.description ?? "");
    const totalSecs = lesson.durationSeconds ?? 0;
    setLessonMinutes(Math.floor(totalSecs / 60));
    setLessonSeconds(totalSecs % 60);
    setLessonIsPreview(lesson.isPreview);
    setLessonDialogOpen(true);
  };

  // Submit Lesson Form (Create or Edit)
  const handleSaveLesson = () => {
    if (!lessonTitle.trim() || lessonTitle.trim().length < 3) {
      toast.error("Lesson title must be at least 3 characters long.");
      return;
    }

    const durationSeconds = Math.max(0, lessonMinutes * 60 + lessonSeconds);

    startTransition(async () => {
      if (editingLesson) {
        // Edit existing lesson
        const res = await updateLessonAction(course.id, editingLesson.id, {
          title: lessonTitle.trim(),
          slug: lessonSlug.trim() || undefined,
          description: lessonDescription.trim() || null,
          durationSeconds: durationSeconds > 0 ? durationSeconds : null,
          isPreview: lessonIsPreview,
        });

        if (res.success && res.data) {
          const updatedLessons = lessons.map((l) =>
            l.id === editingLesson.id ? res.data! : l
          );
          serverLessonsRef.current = updatedLessons;
          setLessons(updatedLessons);
          setLessonDialogOpen(false);
          toast.success(`Updated "${res.data.title}".`);
        } else {
          toast.error(res.error || "Failed to update lesson.");
        }
      } else {
        // Create new lesson
        const res = await createLessonAction(course.id, {
          title: lessonTitle.trim(),
          slug: lessonSlug.trim() || undefined,
          description: lessonDescription.trim() || null,
          durationSeconds: durationSeconds > 0 ? durationSeconds : null,
          isPreview: lessonIsPreview,
        });

        if (res.success && res.data) {
          const appendedLessons = [...lessons, res.data!];
          serverLessonsRef.current = appendedLessons;
          setLessons(appendedLessons);
          setLessonDialogOpen(false);
          toast.success(`Added "${res.data.title}" to curriculum.`);
        } else {
          toast.error(res.error || "Failed to add lesson.");
        }
      }
    });
  };

  // Open Delete Confirmation Dialog
  const handleOpenDeleteDialog = (lesson: Lesson) => {
    setDeletingLesson(lesson);
    setDeleteDialogOpen(true);
  };

  // Confirm Delete
  const handleConfirmDelete = () => {
    if (!deletingLesson) return;

    startTransition(async () => {
      const res = await deleteLessonAction(course.id, deletingLesson.id);

      if (res.success) {
        serverLessonsRef.current = serverLessonsRef.current.filter(
          (l) => l.id !== deletingLesson.id
        );
        setLessons(serverLessonsRef.current);
        setDeleteDialogOpen(false);
        setDeletingLesson(null);
        toast.success(`Deleted "${deletingLesson.title}".`);
      } else {
        toast.error(res.error || "Failed to delete lesson.");
      }
    });
  };

  // Reorder Lessons Up/Down
  const handleMoveLesson = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= lessons.length) return;

    const newLessons = [...lessons];
    const [moved] = newLessons.splice(index, 1);
    newLessons.splice(targetIndex, 0, moved);

    // Optimistically update
    setLessons(newLessons);

    startTransition(async () => {
      const lessonIds = newLessons.map((l) => l.id);
      const res = await reorderLessonsAction(course.id, lessonIds);
      if (res.success && res.data) {
        serverLessonsRef.current = res.data;
        setLessons(res.data);
      } else {
        // Revert on failure to last server-confirmed order
        setLessons(serverLessonsRef.current);
        toast.error(res.error || "Failed to reorder lessons");
      }
    });
  };

  return (
    <div className="w-full max-w-[1200px] mx-auto px-4 md:px-6 py-6 md:py-10 flex flex-col gap-8">
      {/* Top Breadcrumbs & Back Navigation */}
      <div className="flex items-center justify-between pb-4 border-b border-hairline">
        <Button
          variant="ghost"
          size="sm"
          render={<Link href="/dashboard/courses" />}
          className="text-slate-gray hover:text-ink-black -ml-3 px-3 gap-2 font-normal"
        >
          <ArrowLeft className="size-4" />
          <span>Back to curriculum ledger</span>
        </Button>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            render={<Link href={`/${course.slug}`} target="_blank" />}
            className="rounded-full border-hairline text-slate-gray hover:text-ink-black text-xs font-medium"
          >
            <Eye className="size-3.5 mr-1.5" />
            <span>Public preview</span>
          </Button>
        </div>
      </div>

      {/* Editorial Header with Title and Publication Switch */}
      <header className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-wider font-medium text-ash-gray font-sohne">
            Course Editor · Syllabus & Curriculum
          </span>
          <span className="inline-block size-1 rounded-full bg-ash-gray/60" />
          {isComingSoon ? (
            <Badge className="bg-amber-100 text-amber-900 border-amber-200 text-xs px-2.5 py-0.5 rounded-full font-medium">
              Coming Soon (0 lessons)
            </Badge>
          ) : isPurchaseReady ? (
            <Badge className="bg-mist-gray text-ink-black border-hairline text-xs px-2.5 py-0.5 rounded-full font-medium">
              Live & Purchase-Ready
            </Badge>
          ) : (
            <Badge variant="outline" className="text-slate-gray border-hairline text-xs px-2.5 py-0.5 rounded-full font-medium">
              Draft Manuscript
            </Badge>
          )}
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h1 className="font-serif text-3xl md:text-[40px] text-ink-black font-normal leading-tight tracking-tight">
            {course.title}
          </h1>

          {/* Publication Toggle Switch */}
          <div className="flex items-center gap-3 self-start md:self-auto bg-paper-white border border-hairline rounded-full px-4 py-2 shadow-sm">
            <span className="text-xs font-medium text-slate-gray font-sohne">
              {isPublished ? "Published" : "Draft"}
            </span>
            <Switch
              checked={isPublished}
              onCheckedChange={handleTogglePublish}
              disabled={isPending}
              aria-label="Toggle course publication"
            />
          </div>
        </div>

        {/* Readiness notice if published with 0 lessons */}
        {isComingSoon && (
          <div
            role="alert"
            className="flex items-start gap-3 p-4 rounded-inputs bg-amber-50 border border-amber-200 text-amber-900 text-sm"
          >
            <AlertTriangle className="size-5 shrink-0 mt-0.5 text-amber-700" />
            <div>
              <p className="font-medium font-sohne">
                Published with 0 curriculum lessons (Coming Soon status)
              </p>
              <p className="text-xs text-amber-800/90 mt-0.5 leading-relaxed font-sohne">
                Learners can discover this monograph in the catalog, but purchase checkout is disabled until at least one curriculum lecture is added.
              </p>
            </div>
          </div>
        )}
      </header>

      {/* Main Studio Grid: Left Syllabus/Curriculum, Right Course Metadata */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Curriculum & Lesson Management (7 cols) */}
        <section className="lg:col-span-7 flex flex-col gap-6" aria-labelledby="curriculum-heading">
          <div className="flex items-center justify-between border-b border-hairline pb-4">
            <div>
              <h2 id="curriculum-heading" className="font-serif text-2xl text-ink-black font-normal">
                Curriculum Syllabus
              </h2>
              <p className="text-xs text-slate-gray mt-0.5 font-sohne">
                {lessons.length} {lessons.length === 1 ? "lecture" : "lectures"} · {formatCurriculumDuration(totalDurationSeconds)}
              </p>
            </div>

            <Button
              onClick={handleOpenCreateLesson}
              className="rounded-full bg-ink-black text-paper-white px-4 py-2 text-xs font-medium hover:opacity-90 transition-opacity flex items-center gap-1.5"
            >
              <Plus className="size-4" />
              <span>Add lesson</span>
            </Button>
          </div>

          {/* Lessons List */}
          {lessons.length > 0 ? (
            <div className="flex flex-col gap-3" role="list">
              {lessons.map((lesson, index) => {
                const lessonNumber = (index + 1).toString().padStart(2, "0");

                return (
                  <Card
                    key={lesson.id}
                    role="listitem"
                    className="p-4 bg-paper-white rounded-[16px] border border-hairline hover:border-slate-gray/30 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    {/* Left details */}
                    <div className="flex items-start md:items-center gap-3 flex-1 min-w-0">
                      {/* Reorder Buttons */}
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={index === 0 || isPending}
                          onClick={() => handleMoveLesson(index, "up")}
                          aria-label={`Move lesson ${lesson.title} up`}
                          className="size-6 text-slate-gray hover:text-ink-black disabled:opacity-30"
                        >
                          <ArrowUp className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={index === lessons.length - 1 || isPending}
                          onClick={() => handleMoveLesson(index, "down")}
                          aria-label={`Move lesson ${lesson.title} down`}
                          className="size-6 text-slate-gray hover:text-ink-black disabled:opacity-30"
                        >
                          <ArrowDown className="size-3.5" />
                        </Button>
                      </div>

                      {/* Number & Icon */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-xs text-ash-gray font-medium">
                          {lessonNumber}
                        </span>
                        <div className="size-8 rounded-lg bg-mist-gray flex items-center justify-center text-slate-gray">
                          <Video className="size-4 stroke-[1.75]" />
                        </div>
                      </div>

                      {/* Title, slug, duration, badges */}
                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-medium text-ink-black font-sohne truncate">
                            {lesson.title}
                          </h3>
                          {lesson.isPreview && (
                            <Badge className="bg-mist-gray text-ink-black border border-hairline text-[10px] px-2 py-0 rounded-full font-medium">
                              Free Preview
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-gray mt-1 font-sohne">
                          <span className="flex items-center gap-1">
                            <Clock className="size-3 text-ash-gray" />
                            {formatDuration(lesson.durationSeconds)}
                          </span>
                          <span>•</span>
                          <span className="text-ash-gray">
                            No video uploaded (metadata mode)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right actions */}
                    <div className="flex items-center gap-1.5 self-end md:self-center shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-hairline w-full md:w-auto justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEditLesson(lesson)}
                        aria-label={`Edit ${lesson.title}`}
                        className="size-8 text-slate-gray hover:text-ink-black"
                      >
                        <Pencil className="size-3.5" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDeleteDialog(lesson)}
                        aria-label={`Delete ${lesson.title}`}
                        className="size-8 text-slate-gray hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="p-8 bg-paper-white rounded-[20px] border border-hairline text-center flex flex-col items-center justify-center gap-3">
              <div className="size-12 rounded-full bg-mist-gray flex items-center justify-center text-slate-gray">
                <Video className="size-5 stroke-[1.5]" />
              </div>
              <div className="max-w-sm">
                <h3 className="text-base font-medium text-ink-black font-serif">
                  No curriculum lessons yet
                </h3>
                <p className="text-xs text-slate-gray mt-1 font-sohne">
                  Organize your course syllabus with structured chapters and lectures.
                </p>
              </div>
              <Button
                onClick={handleOpenCreateLesson}
                variant="outline"
                className="mt-2 rounded-full border-hairline text-ink-black text-xs font-medium px-5"
              >
                <Plus className="size-3.5 mr-1.5" />
                <span>Add first lecture</span>
              </Button>
            </Card>
          )}

          {/* Add lesson dashed footer button */}
          {lessons.length > 0 && (
            <Button
              onClick={handleOpenCreateLesson}
              variant="outline"
              className="w-full py-6 rounded-[16px] border-dashed border-slate-gray/30 hover:border-ink-black hover:bg-mist-gray/40 text-slate-gray hover:text-ink-black text-xs font-medium flex items-center justify-center gap-2 transition-all"
            >
              <Plus className="size-4" />
              <span>Add another lesson to curriculum</span>
            </Button>
          )}
        </section>

        {/* Right Column: Course Metadata & Prospectus Form (5 cols) */}
        <section className="lg:col-span-5" aria-labelledby="metadata-heading">
          <Card className="p-6 bg-paper-white rounded-cards border border-hairline shadow-subtle flex flex-col gap-6">
            <div className="border-b border-hairline pb-4">
              <h2 id="metadata-heading" className="font-serif text-2xl text-ink-black font-normal">
                Course Prospectus
              </h2>
              <p className="text-xs text-slate-gray mt-0.5 font-sohne">
                Core monograph metadata, pricing, and catalog presentation.
              </p>
            </div>

            <form onSubmit={handleSaveMetadata} className="flex flex-col gap-5">
              {/* Title */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="course-title">Title</Label>
                <Input
                  id="course-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="Course title"
                  className="h-11 text-sm rounded-inputs"
                />
              </div>

              {/* Slug */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="course-slug">Catalog URL Slug</Label>
                  <span className="text-[11px] text-ash-gray font-mono">/{slug}</span>
                </div>
                <Input
                  id="course-slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="url-slug"
                  className="h-11 text-sm font-mono rounded-inputs"
                />
              </div>

              {/* Category Pills */}
              <div className="flex flex-col gap-1.5">
                <Label>Subject Category</Label>
                <div className="flex flex-wrap gap-2 pt-1">
                  {COURSE_CATEGORIES.map((cat) => (
                    <Button
                      key={cat}
                      type="button"
                      variant={category === cat ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCategory(cat)}
                      className={`rounded-full text-xs font-medium px-3.5 py-1 ${
                        category === cat
                          ? "bg-ink-black text-paper-white"
                          : "border-hairline text-slate-gray hover:text-ink-black"
                      }`}
                    >
                      {cat}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="course-description">Syllabus Monograph</Label>
                  <span className="text-[11px] text-ash-gray">
                    {description.length}/1000
                  </span>
                </div>
                <Textarea
                  id="course-description"
                  rows={4}
                  maxLength={1000}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Overview of core concepts, thesis, and objectives..."
                  className="text-sm rounded-inputs leading-relaxed"
                />
              </div>

              {/* Price ($19–$199 PRD Constraint) */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="course-price">Standalone Price (USD)</Label>
                  <span className="text-[11px] text-slate-gray font-medium">$19 – $199</span>
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-gray text-sm font-medium select-none pointer-events-none">
                    $
                  </span>
                  <Input
                    id="course-price"
                    type="number"
                    min={19}
                    max={199}
                    step={1}
                    value={priceDollars === 0 ? "" : priceDollars}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPriceDollars(val === "" ? 0 : Number.parseInt(val, 10) || 0);
                    }}
                    required
                    className="h-11 pl-8 text-sm font-medium rounded-inputs"
                  />
                </div>
                <p className="text-[11px] text-slate-gray leading-relaxed font-sohne">
                  One-time price for perpetual ownership. Automatically included for All-Access subscribers.
                </p>
              </div>

              {/* Thumbnail URL & Live Preview */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="course-thumb">Cover Monograph URL (16:9)</Label>
                <Input
                  id="course-thumb"
                  type="url"
                  value={thumbnailUrl}
                  onChange={(e) => setThumbnailUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="h-11 text-xs rounded-inputs"
                />

                {thumbnailUrl ? (
                  <div className="relative aspect-video w-full rounded-images overflow-hidden bg-mist-gray mt-2 border border-hairline">
                    <Image
                      src={thumbnailUrl}
                      alt="Thumbnail preview"
                      fill
                      className="object-cover"
                      sizes="300px"
                    />
                  </div>
                ) : (
                  <div className="aspect-video w-full rounded-images bg-mist-gray flex items-center justify-center text-ash-gray text-xs mt-2 border border-hairline">
                    No preview image specified
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-4 border-t border-hairline flex items-center justify-end">
                <Button
                  type="submit"
                  disabled={isPending}
                  className="rounded-full bg-ink-black text-paper-white px-6 text-xs font-medium hover:opacity-90 transition-opacity"
                >
                  {isPending ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="size-3.5 animate-spin" />
                      <span>Saving changes...</span>
                    </span>
                  ) : (
                    <span>Save course metadata</span>
                  )}
                </Button>
              </div>
            </form>
          </Card>
        </section>
      </div>

      {/* Create / Edit Lesson Dialog */}
      <Dialog open={lessonDialogOpen} onOpenChange={setLessonDialogOpen}>
        <DialogContent className="max-w-lg bg-paper-white rounded-cards p-6">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl text-ink-black">
              {editingLesson ? "Edit Curriculum Lecture" : "Add Lecture to Curriculum"}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-gray">
              Define the lesson title, syllabus outline, and free preview availability.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="modal-lesson-title">Lesson Title</Label>
              <Input
                id="modal-lesson-title"
                value={lessonTitle}
                onChange={(e) => setLessonTitle(e.target.value)}
                placeholder="e.g. 01 — Form and Cadence in Book Design"
                className="h-10 text-sm rounded-inputs"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="modal-lesson-slug">URL Slug</Label>
                <span className="text-[11px] text-ash-gray">Auto-generated if blank</span>
              </div>
              <Input
                id="modal-lesson-slug"
                value={lessonSlug}
                onChange={(e) => setLessonSlug(e.target.value)}
                placeholder="lesson-url-slug"
                className="h-10 text-xs font-mono rounded-inputs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="modal-lesson-mins">Duration (Minutes)</Label>
                <Input
                  id="modal-lesson-mins"
                  type="number"
                  min={0}
                  value={lessonMinutes}
                  onChange={(e) => setLessonMinutes(Math.max(0, Number.parseInt(e.target.value, 10) || 0))}
                  className="h-10 text-sm rounded-inputs"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="modal-lesson-secs">Duration (Seconds)</Label>
                <Input
                  id="modal-lesson-secs"
                  type="number"
                  min={0}
                  max={59}
                  value={lessonSeconds}
                  onChange={(e) => setLessonSeconds(Math.min(59, Math.max(0, Number.parseInt(e.target.value, 10) || 0)))}
                  className="h-10 text-sm rounded-inputs"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="modal-lesson-desc">Synopsis / Notes (Optional)</Label>
              <Textarea
                id="modal-lesson-desc"
                rows={3}
                value={lessonDescription}
                onChange={(e) => setLessonDescription(e.target.value)}
                placeholder="Brief lecture monograph notes or learning outcomes..."
                className="text-xs rounded-inputs"
              />
            </div>

            {/* Free Preview Switch */}
            <div className="flex items-center justify-between p-3 rounded-inputs bg-mist-gray/60 border border-hairline">
              <div className="flex flex-col">
                <span className="text-xs font-medium text-ink-black font-sohne">
                  Free Access Preview
                </span>
                <span className="text-[11px] text-slate-gray">
                  Allow non-enrolled learners to watch this lesson
                </span>
              </div>
              <Switch
                checked={lessonIsPreview}
                onCheckedChange={setLessonIsPreview}
                aria-label="Toggle free preview"
              />
            </div>
          </div>

          <DialogFooter className="border-t border-hairline pt-4 mt-2">
            <Button
              variant="outline"
              onClick={() => setLessonDialogOpen(false)}
              className="rounded-full text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveLesson}
              disabled={isPending}
              className="rounded-full bg-ink-black text-paper-white text-xs font-medium px-5"
            >
              {isPending ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Saving...</span>
                </span>
              ) : (
                <span>{editingLesson ? "Save Changes" : "Add Lecture"}</span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Lesson Confirmation Alert Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-md bg-paper-white rounded-cards p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-xl text-ink-black">
              Delete Lecture
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-gray leading-relaxed">
              Are you sure you want to permanently delete{" "}
              <strong className="text-ink-black font-medium">&ldquo;{deletingLesson?.title}&rdquo;</strong>?
              This action cannot be reversed.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter className="border-t border-hairline pt-4 mt-2">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              className="rounded-full text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isPending}
              className="rounded-full text-xs font-medium px-5"
            >
              {isPending ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Deleting...</span>
                </span>
              ) : (
                <span>Delete lecture</span>
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
