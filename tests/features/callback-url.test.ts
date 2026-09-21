import { describe, it, expect } from "vitest";
import { getSafeCallbackUrl } from "@/lib/callback-url";

describe("getSafeCallbackUrl", () => {
  it("returns legitimate relative paths unchanged", () => {
    expect(getSafeCallbackUrl("/billing")).toBe("/billing");
    expect(getSafeCallbackUrl("/courses/my-course")).toBe("/courses/my-course");
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
    expect(getSafeCallbackUrl("//evil.com")).toBe("/");
    expect(getSafeCallbackUrl("/\\evil.com")).toBe("/");
  });

  it("rejects javascript: and other pseudo-protocols", () => {
    expect(getSafeCallbackUrl("javascript:alert(1)")).toBe("/");
    expect(getSafeCallbackUrl("data:text/html,<script>alert(1)</script>")).toBe("/");
  });

  it("rejects CRLF/newline-based bypass attempts", () => {
    expect(getSafeCallbackUrl("/\r\njavascript:alert(1)")).toBe("/");
    expect(getSafeCallbackUrl("/\n/evil.com")).toBe("/");
    expect(getSafeCallbackUrl("/\tevil.com")).toBe("/");
  });

  it("rejects non-string paths", () => {
    expect(getSafeCallbackUrl("dashboard")).toBe("/");
  });
});