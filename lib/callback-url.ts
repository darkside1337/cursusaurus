export function getSafeCallbackUrl(value: string | null): string {
	if (value && value.startsWith("/") && !value.startsWith("//")) return value;
	return "/";
}