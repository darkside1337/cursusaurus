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
