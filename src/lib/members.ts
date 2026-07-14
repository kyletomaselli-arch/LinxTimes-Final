import "server-only";
import { prisma } from "./prisma";
import type { Member } from "../generated/prisma";

/**
 * Resolve a list of human-entered member codes to distinct, active members of a
 * course. Matching is case-insensitive; duplicate codes collapse to one member.
 * A legacy single `memberId` can be folded in via the `codes` array.
 */
export async function resolveMembers(courseId: string, codes: string[]): Promise<Member[]> {
  const wanted = new Set(
    codes.map((c) => c.trim().toLowerCase()).filter((c) => c.length > 0)
  );
  if (wanted.size === 0) return [];
  const active = await prisma.member.findMany({ where: { courseId, isActive: true } });
  return active.filter((m) => wanted.has(m.memberId.toLowerCase()));
}
