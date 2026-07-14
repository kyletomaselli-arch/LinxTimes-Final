/**
 * Human-readable confirmation numbers: SLUG-YYYYMMDD-NNNN
 * e.g. WINGED-PHEASANT-GOLF-LINKS-20260630-0001
 *
 * NNNN is a per-course, per-day sequence. Generation is collision-safe: the
 * caller creates the booking inside a retry loop and the DB's unique constraint
 * on confirmationNo is the final arbiter under concurrency.
 */

export function buildConfirmationNo(
  slug: string,
  dateKey: string,
  sequence: number
): string {
  const datePart = dateKey.replace(/-/g, "");
  const seqPart = String(sequence).padStart(4, "0");
  return `${slug.toUpperCase()}-${datePart}-${seqPart}`;
}
