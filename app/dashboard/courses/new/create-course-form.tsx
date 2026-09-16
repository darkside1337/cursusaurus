"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createCourseAction } from "./actions";
import { generateSlug } from "@/features/courses/slug";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function CreateCourseForm() {
  const [state, formAction, isPending] = useActionState(createCourseAction, null);
  const [title, setTitle] = useState("");
  const [customSlug, setCustomSlug] = useState("");
  const [description, setDescription] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  const autoSlug = generateSlug(title);
  const displaySlug = customSlug || autoSlug;
  const wordCount = description.trim()
    ? description.trim().split(/\s+/).length
    : 0;

  const markDirty = () => setIsDirty(true);

  useEffect(() => {
    if (state?.error) {
      toast.error(state.error);
    }
  }, [state?.error]);

  return (
    <div className="w-full max-w-[720px] mx-auto py-8 md:py-12 flex flex-col gap-8">
      {/* Top back navigation */}
      <div className="w-full flex items-center justify-between pb-4 border-b border-hairline">
        <Button
          variant="ghost"
          render={<Link href="/dashboard/courses" />}
          className="text-slate-gray hover:text-ink-black -ml-3 px-3 gap-1.5 font-normal flex items-center"
        >
          <ArrowLeft className="size-4" />
          <span>Back to courses</span>
        </Button>

        {isDirty && (
          <div className="flex items-center gap-2">
            <span className="inline-block size-2 rounded-full bg-slate-gray/40" />
            <span className="text-xs text-slate-gray uppercase tracking-wider font-sohne">
              Unsaved Changes
            </span>
          </div>
        )}
      </div>

      {/* Editorial Header */}
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-ash-gray font-medium font-sohne">
            Course Formulation · Creator Studio
          </span>
          <span className="inline-block size-1 rounded-full bg-ash-gray/60" />
          <Badge className="bg-blush-peach text-sienna-brown border-none font-medium text-xs px-2.5 py-0.5 rounded-full">
            Drafting Mode
          </Badge>
        </div>

        <h1 className="font-serif text-3xl md:text-[40px] text-ink-black font-normal leading-tight mt-1">
          Create a new course
        </h1>
        <p className="text-slate-gray font-sohne text-[15px] md:text-base">
          Author a deliberate, craft-focused masterclass for the Cursusaurus catalog.
        </p>
      </header>

      {/* Main Formulation Form */}
      <form action={formAction} className="flex flex-col gap-6">
        {/* Course Title */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="title">Course title</Label>
            <span className="text-xs text-ash-gray font-sohne">Required (3–100 chars)</span>
          </div>
          <Input
            id="title"
            name="title"
            required
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              markDirty();
            }}
            placeholder="e.g. Architectural Principles in Typography"
            className="h-12 text-[15px]"
          />
        </div>

        {/* Slug Field */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="slug">Catalog URL Slug</Label>
            <span className="text-xs text-ash-gray font-sohne">Auto-generated if empty</span>
          </div>
          <Input
            id="slug"
            name="slug"
            value={customSlug}
            onChange={(e) => {
              setCustomSlug(e.target.value);
              markDirty();
            }}
            placeholder={autoSlug || "course-url-slug"}
            className="h-12 font-mono text-sm"
          />
          {displaySlug && (
            <p className="text-xs text-slate-gray font-sohne">
              Preview URL: <span className="font-mono text-ink-black">/{displaySlug}</span>
            </p>
          )}
        </div>

        {/* Course Syllabus / Description */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="description">Course syllabus & monograph</Label>
            <span className="text-xs text-ash-gray font-sohne">
              {wordCount} / 600 words
            </span>
          </div>
          <Textarea
            id="description"
            name="description"
            rows={5}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              markDirty();
            }}
            placeholder="Describe the syllabus, prerequisites, and enduring concepts covered in this monograph..."
            className="text-[15px] leading-relaxed"
          />
        </div>

        {/* Price ($19–$199 PRD Constraint) */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="price">Standalone acquisition price (USD)</Label>
          <div className="relative w-full max-w-[240px]">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-gray font-medium select-none pointer-events-none">
              $
            </span>
            <Input
              id="price"
              name="price"
              type="number"
              min={19}
              max={199}
              step={1}
              defaultValue={49}
              onChange={markDirty}
              required
              className="h-12 pl-8 font-sohne text-[16px] font-medium"
            />
          </div>
          <p className="text-xs text-slate-gray leading-relaxed font-sohne">
            Must be between $19 and $199. Included automatically for All-Access subscribers; standalone purchasers retain perpetual ownership.
          </p>
        </div>

        {/* Thumbnail URL */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="thumbnailUrl">Cover monograph & preview image URL</Label>
            <span className="text-xs text-ash-gray font-sohne">Aspect ratio 16:9</span>
          </div>
          <Input
            id="thumbnailUrl"
            name="thumbnailUrl"
            type="url"
            placeholder="https://images.unsplash.com/..."
            onChange={markDirty}
            className="h-12 text-[14px]"
          />
          <p className="text-xs text-slate-gray font-sohne">
            Optional image URL displayed on course cards and catalog details.
          </p>
        </div>

        {/* Editorial Review Process Notice */}
        <Card className="bg-mist-gray/60 border border-hairline rounded-[16px] p-4 flex items-start gap-3.5">
          <CheckCircle2 className="size-5 text-sienna-brown shrink-0 mt-0.5" />
          <div className="flex flex-col">
            <span className="text-xs font-medium text-ink-black font-sohne uppercase tracking-wider">
              Editorial Review Process
            </span>
            <p className="text-xs text-slate-gray mt-0.5 leading-relaxed font-sohne">
              All submitted masterclasses undergo review by Cursusaurus fellows to verify typography, pacing, and audio fidelity before appearance on the public prospectus.
            </p>
          </div>
        </Card>

        {/* Form Action Controls */}
        <div className="pt-4 border-t border-hairline flex items-center justify-between">
          <Button
            variant="ghost"
            render={<Link href="/dashboard/courses" />}
            className="text-slate-gray hover:text-destructive"
          >
            Discard formulation
          </Button>

          <Button
            type="submit"
            disabled={isPending}
            className="rounded-full bg-ink-black text-paper-white px-7 py-2.5 font-medium hover:opacity-90 transition-opacity"
          >
            {isPending ? (
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                <span>Creating course...</span>
              </span>
            ) : (
              <span>Create course</span>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
