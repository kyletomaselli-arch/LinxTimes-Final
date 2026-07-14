import "server-only";
import { prisma } from "./prisma";

/** Resolve the first valid (active, unredeemed) rain-check code among the entered codes. */
export async function resolveRainCheck(
  courseId: string,
  codes: string[]
): Promise<{ id: string; code: string; amountCents: number } | null> {
  const wanted = new Set(codes.map((c) => c.trim().toLowerCase()).filter(Boolean));
  if (wanted.size === 0) return null;
  const active = await prisma.rainCheck.findMany({
    where: { courseId, isActive: true, redeemedAt: null },
  });
  for (const rc of active) {
    if (wanted.has(rc.code.toLowerCase())) {
      return { id: rc.id, code: rc.code, amountCents: rc.amountCents };
    }
  }
  return null;
}

/** Generate a short, unambiguous bearer code, e.g. "RC-7QK2P9". */
export function generateRainCheckCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no O/0/I/1/L
  let s = "";
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `RC-${s}`;
}
