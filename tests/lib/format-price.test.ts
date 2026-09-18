import { describe, it, expect } from "vitest";
import { formatPriceCents, parsePriceDollarsToCents } from "@/lib/format-price";

describe("lib/format-price", () => {
  describe("parsePriceDollarsToCents", () => {
    it("safely parses fractional dollar strings without IEEE-754 precision drift", () => {
      // 19.99 * 100 in raw float is 1998.9999999999998
      expect(parsePriceDollarsToCents("19.99")).toBe(1999);
      expect(parsePriceDollarsToCents(19.99)).toBe(1999);
      expect(parsePriceDollarsToCents("29.95")).toBe(2995);
    });

    it("parses integer dollar values", () => {
      expect(parsePriceDollarsToCents("49")).toBe(4900);
      expect(parsePriceDollarsToCents(49)).toBe(4900);
      expect(parsePriceDollarsToCents("199")).toBe(19900);
    });

    it("handles zero and invalid inputs gracefully", () => {
      expect(parsePriceDollarsToCents("0")).toBe(0);
      expect(parsePriceDollarsToCents(0)).toBe(0);
      expect(parsePriceDollarsToCents("-10")).toBe(0);
      expect(parsePriceDollarsToCents("abc")).toBe(0);
    });
  });

  describe("formatPriceCents", () => {
    it("formats whole dollars without decimals", () => {
      expect(formatPriceCents(4900)).toBe("$49");
      expect(formatPriceCents(1500)).toBe("$15");
      expect(formatPriceCents(0)).toBe("$0");
    });

    it("formats cents with two decimal places", () => {
      expect(formatPriceCents(1999)).toBe("$19.99");
      expect(formatPriceCents(2995)).toBe("$29.95");
    });
  });
});
