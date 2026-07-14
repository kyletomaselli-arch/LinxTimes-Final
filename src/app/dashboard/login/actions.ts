"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createCourseSession, destroyCourseSession } from "@/lib/session";
import { hit } from "@/lib/rate-limit";

export interface LoginState {
  error: string | null;
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  // Throttle brute-force attempts per IP.
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = hit(`login:${ip}`, 10, 5 * 60 * 1000);
  if (!rl.ok) {
    return { error: "Too many attempts. Please try again in a few minutes." };
  }

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const admin = await prisma.courseAdmin.findUnique({ where: { email } });
  // Always run a compare to avoid leaking whether the email exists (timing).
  const hash = admin?.passwordHash ?? "$2a$12$" + "x".repeat(53);
  const valid = await bcrypt.compare(password, hash);
  if (!admin || !valid) {
    return { error: "Invalid email or password." };
  }

  await createCourseSession(admin.id, admin.courseId);
  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  await destroyCourseSession();
  redirect("/dashboard/login");
}
