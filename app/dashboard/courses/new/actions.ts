"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getServerSession } from "@/lib/auth";
import { createCourse } from "@/features/courses";
import { parsePriceDollarsToCents } from "@/lib/format-price";
import { ActionError, logActionError } from "@/lib/action-errors";
import { formatZodError } from "@/lib/safe-action";

export interface CreateCourseActionState {
  error?: string | null;
}

export async function createCourseAction(
  _prevState: CreateCourseActionState | null,
  formData: FormData
): Promise<CreateCourseActionState> {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return { error: "Authentication required to create a course" };
  }

  const title = (formData.get("title") as string) || "";
  const rawSlug = (formData.get("slug") as string) || "";
  const description = (formData.get("description") as string) || null;
  const priceRaw = (formData.get("price") as string) || "";
  const priceCents = parsePriceDollarsToCents(priceRaw);
  const thumbnailUrl = (formData.get("thumbnailUrl") as string) || null;

  if (priceCents < 1900 || priceCents > 19900) {
    return { error: "Price must be between $19 and $199" };
  }

  let createdCourseId: string;

  try {
    const course = await createCourse({
      creatorId: session.user.id,
      title,
      slug: rawSlug.trim() || undefined,
      description: description?.trim() || null,
      thumbnailUrl: thumbnailUrl?.trim() || null,
      priceCents,
      isPublished: false,
    });
    createdCourseId = course.id;
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return { error: formatZodError(err) };
    }
    if (err instanceof ActionError) {
      return { error: err.message };
    }
    logActionError("createCourseAction", err, { userId: session.user.id });
    return { error: "An unexpected error occurred. Please try again." };
  }

  redirect(`/dashboard/courses/${createdCourseId}`);
}
