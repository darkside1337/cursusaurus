export function getSafeCallbackUrl(
  value: string | null | undefined,
  defaultUrl = "/"
): string {
  if (
    value &&
    typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.startsWith("/\\") &&
    !/[\r\n\t]/.test(value)
  ) {
    return value;
  }
  return defaultUrl;
}