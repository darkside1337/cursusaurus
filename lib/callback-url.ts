export function getSafeCallbackUrl(
  value: string | null | undefined,
  defaultUrl = "/"
): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  return defaultUrl;
}