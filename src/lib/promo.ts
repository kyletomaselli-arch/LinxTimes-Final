import "server-only";
import { prisma } from "./prisma";
import type { AppliedPromo } from "./pricing";

/**
 * Resolve the first valid promo code among the entered codes for a course.
 * Valid = active, not expired, and under its redemption cap. Returns the applied
 * promo plus its row id (so a booking can increment the redemption count).
 */
export async function resolvePromo(
  courseId: string,
  codes: string[]
): Promise<{ promo: AppliedPromo; id: string } | null> {
  const wanted = new Set(codes.map((c) => c.trim().toLowerCase()).filter(Boolean));
  if (wanted.size === 0) return null;

  const now = new Date();
  const active = await prisma.promoCode.findMany({ where: { courseId, isActive: true } });
  for (const p of active) {
    if (!wanted.has(p.code.toLowerCase())) continue;
    if (p.expiresAt && p.expiresAt < now) continue;
    if (p.maxRedemptions != null && p.timesRedeemed >= p.maxRedemptions) continue;
    return { promo: { code: p.code, kind: p.kind, value: p.value }, id: p.id };
  }
  return null;
}
