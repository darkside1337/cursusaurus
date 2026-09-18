/**
 * Formats price in cents to human-readable dollar format.
 * Returns whole dollars when cents % 100 === 0 ($49),
 * otherwise two decimals ($19.99).
 */
export function formatPriceCents(cents: number): string {
  if (cents % 100 === 0) {
    return `$${cents / 100}`;
  }
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Safely parses dollar string or number input into integer cents.
 * Uses Math.round to eliminate floating-point precision issues (e.g. 19.99 * 100 = 1998.9999999999998).
 */
export function parsePriceDollarsToCents(price: string | number): number {
  const num = typeof price === "number" ? price : parseFloat(price);
  if (isNaN(num) || num < 0) return 0;
  return Math.round(num * 100);
}
