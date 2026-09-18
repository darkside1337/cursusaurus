/**
 * Generates a URL-friendly slug from a course title.
 */
export function generateSlug(title: string): string {
  const cleaned = title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!cleaned) {
    return `course-${crypto.randomUUID().slice(0, 8)}`;
  }

  return cleaned;
}
