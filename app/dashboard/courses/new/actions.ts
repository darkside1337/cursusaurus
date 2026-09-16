"use server";

import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth";
import { createCourse } from "@/features/courses";

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
  const priceRaw = formData.get("price") as string;
  const priceDollars = Number.parseInt(priceRaw, 10);
  const thumbnailUrl = (formData.get("thumbnailUrl") as string) || null;

  if (Number.isNaN(priceDollars)) {
    return { error: "Price must be a valid integer number of dollars" };
  }

  const priceCents = priceDollars * 100;

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
    const message = err instanceof Error ? err.message : "Failed to create course";
    return { error: message };
  }

  redirect(`/dashboard/courses/${createdCourseId}`);
}
