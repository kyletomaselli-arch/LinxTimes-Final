import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import { signToken, verifyToken } from "./signing";
import type { SuperAdmin } from "../generated/prisma";

/**
 * LinxTimes super-admin sessions — completely separate auth domain from course
 * admins (different cookie name + token kind), so the two never cross over.
 */

const COOKIE = "lx_super_session";
const TTL_SECONDS = 8 * 60 * 60;

export async function createSuperSession(adminId: string): Promise<void> {
  const token = signToken({ adminId, kind: "super_admin" }, TTL_SECONDS);
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TTL_SECONDS,
  });
}

export async function destroySuperSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export async function getSuperSession(): Promise<{ adminId: string } | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const payload = verifyToken<{ adminId?: string; kind?: string }>(token);
  if (!payload || payload.kind !== "super_admin" || !payload.adminId) return null;
  return { adminId: payload.adminId };
}

export async function requireSuperAdmin(): Promise<SuperAdmin> {
  const session = await getSuperSession();
  if (!session) redirect("/linxtimes-admin/login");
  const admin = await prisma.superAdmin.findUnique({ where: { id: session.adminId } });
  if (!admin) redirect("/linxtimes-admin/login");
  return admin;
}
