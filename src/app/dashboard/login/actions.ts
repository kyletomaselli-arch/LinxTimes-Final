"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createCourseSession, destroyCourseSession } from "@/lib/session";
import { hit } from "@/lib/rate-limit";
import { signToken, verifyToken } from "@/lib/signing";
import { serverEnv } from "@/lib/env";
import { sendPasswordResetEmail } from "@/lib/email";

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

export interface ResetRequestState {
  message: string | null;
  error: string | null;
}

/**
 * Step 1 of password reset: email a signed, 1-hour reset link. Always returns
 * the same message whether or not the email exists, so it can't be used to
 * discover which emails have accounts. Rate limited per IP.
 */
export async function requestPasswordReset(
  _prev: ResetRequestState,
  formData: FormData
): Promise<ResetRequestState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = hit(`pwreset:${ip}`, 5, 15 * 60 * 1000);
  if (!rl.ok) {
    return { message: null, error: "Too many requests. Please try again in a few minutes." };
  }
  if (!email) {
    return { message: null, error: "Enter your email." };
  }

  const admin = await prisma.courseAdmin.findUnique({ where: { email } });
  if (admin) {
    // Bind the token to the current password hash so it becomes single-use:
    // once the password changes, `v` no longer matches and the link is dead.
    const token = signToken(
      { adminId: admin.id, kind: "pw_reset", v: admin.passwordHash.slice(-12) },
      60 * 60
    );
    const url = `${serverEnv.APP_URL}/dashboard/reset?token=${encodeURIComponent(token)}`;
    await sendPasswordResetEmail(admin.email, admin.name, url);
  }

  return {
    message:
      "If an account exists for that email, we've sent a reset link. It expires in 1 hour.",
    error: null,
  };
}

export interface ResetState {
  error: string | null;
  done: boolean;
}

/**
 * Step 2 of password reset: verify the signed link and set a new password.
 * The token is single-use (bound to the old password hash) and expires in 1h.
 */
export async function resetPassword(
  _prev: ResetState,
  formData: FormData
): Promise<ResetState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters.", done: false };
  }
  if (password !== confirm) {
    return { error: "Passwords don't match.", done: false };
  }

  const payload = verifyToken<{ adminId?: string; kind?: string; v?: string }>(token);
  if (!payload || payload.kind !== "pw_reset" || !payload.adminId) {
    return { error: "This reset link is invalid or has expired. Request a new one.", done: false };
  }

  const admin = await prisma.courseAdmin.findUnique({ where: { id: payload.adminId } });
  if (!admin || admin.passwordHash.slice(-12) !== payload.v) {
    return {
      error: "This reset link has already been used or expired. Request a new one.",
      done: false,
    };
  }

  await prisma.courseAdmin.update({
    where: { id: admin.id },
    data: { passwordHash: await bcrypt.hash(password, 12) },
  });

  return { error: null, done: true };
}
