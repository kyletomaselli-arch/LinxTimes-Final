/** All money is stored as integer cents. Never use floats for money. */

export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

/** Format without the trailing .00 when whole dollars, e.g. "$55" / "$55.50". */
export function formatCentsCompact(cents: number): string {
  const dollars = cents / 100;
  const isWhole = cents % 100 === 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}
