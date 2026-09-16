import { describe, it, expect } from "vitest";
import { getSafeCallbackUrl } from "@/lib/callback-url";

describe("getSafeCallbackUrl", () => {
	it("returns a relative path unchanged", () => {
		expect(getSafeCallbackUrl("/dashboard/courses")).toBe("/dashboard/courses");
		expect(getSafeCallbackUrl("/learn/ts-fundamentals/01")).toBe(
			"/learn/ts-fundamentals/01"
		);
	});

	it("defaults to / for null or empty values", () => {
		expect(getSafeCallbackUrl(null)).toBe("/");
		expect(getSafeCallbackUrl("")).toBe("/");
	});

	it("rejects absolute URLs to prevent open redirects", () => {
		expect(getSafeCallbackUrl("https://evil.example")).toBe("/");
		expect(getSafeCallbackUrl("http://evil.example")).toBe("/");
	});

	it("rejects protocol-relative URLs", () => {
		expect(getSafeCallbackUrl("//evil.example")).toBe("/");
	});

	it("rejects non-string paths", () => {
		expect(getSafeCallbackUrl("dashboard")).toBe("/");
	});
});