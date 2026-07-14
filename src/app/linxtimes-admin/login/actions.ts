"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSuperSession, destroySuperSession } from "@/lib/super-session";
import { hit } from "@/lib/rate-limit";

export interface LoginState {
  error: string | null;
}

export async function superLogin(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!hit(`superlogin:${ip}`, 10, 5 * 60 * 1000).ok) {
    return { error: "Too many attempts. Try again in a few minutes." };
  }
  if (!email || !password) return { error: "Enter your email and password." };

  const admin = await prisma.superAdmin.findUnique({ where: { email } });
  const hash = admin?.passwordHash ?? "$2a$12$" + "x".repeat(53);
  const valid = await bcrypt.compare(password, hash);
  if (!admin || !valid) return { error: "Invalid email or password." };

  await createSuperSession(admin.id);
  redirect("/linxtimes-admin");
}

export async function superLogout(): Promise<void> {
  await destroySuperSession();
  redirect("/linxtimes-admin/login");
}
