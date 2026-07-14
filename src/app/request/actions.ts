"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { hit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
import { serverEnv } from "@/lib/env";

export interface RequestState {
  ok: boolean;
  message: string;
}

/**
 * Self-service access request (Path B). Creates a pending OnboardingRequest and
 * notifies the LinxTimes team. A super-admin reviews it in the super-admin
 * dashboard (Step 9) and, on approval, the owner receives an onboarding link.
 */
export async function submitRequest(_prev: RequestState, formData: FormData): Promise<RequestState> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!hit(`request:${ip}`, 5, 60 * 60 * 1000).ok) {
    return { ok: false, message: "Too many requests. Please try again later." };
  }

  const ownerName = String(formData.get("ownerName") ?? "").trim();
  const courseName = String(formData.get("courseName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  if (!ownerName || !courseName || !emailOk) {
    return { ok: false, message: "Please fill in your name, course name, and a valid email." };
  }

  const estimatedRounds = Number(formData.get("estimatedRounds"));
  await prisma.onboardingRequest.create({
    data: {
      ownerName,
      courseName,
      email,
      city: String(formData.get("city") ?? "").trim() || null,
      state: String(formData.get("state") ?? "").trim() || null,
      phone: String(formData.get("phone") ?? "").trim() || null,
      estimatedRounds: Number.isFinite(estimatedRounds) && estimatedRounds > 0 ? Math.round(estimatedRounds) : null,
      message: String(formData.get("message") ?? "").trim() || null,
      status: "pending",
    },
  });

  // Notify the LinxTimes team.
  if (serverEnv.LINXTIMES_ADMIN_EMAIL) {
    await sendEmail({
      to: serverEnv.LINXTIMES_ADMIN_EMAIL,
      subject: `New course request · ${courseName}`,
      html: `<p>New LinxTimes access request:</p>
        <ul>
          <li><b>Course:</b> ${escape(courseName)}</li>
          <li><b>Owner:</b> ${escape(ownerName)}</li>
          <li><b>Email:</b> ${escape(email)}</li>
          <li><b>Location:</b> ${escape(String(formData.get("city") ?? ""))}, ${escape(String(formData.get("state") ?? ""))}</li>
          <li><b>Est. rounds/yr:</b> ${estimatedRounds || "—"}</li>
        </ul>
        <p>Review it in the super-admin dashboard.</p>`,
    });
  }

  return { ok: true, message: "Request received! We'll review it and email you shortly." };
}

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
