import "server-only";
import { prisma } from "./prisma";
import { getStripe } from "./stripe";
import type { Course } from "../generated/prisma";

/**
 * Go-live readiness. A course must satisfy every essential check before its
 * public booking page can be opened (status → active). This is the single
 * source of truth used both by the `goLive` action (to enforce) and the
 * Settings checklist (to show the owner what's left).
 */
export interface ReadinessCheck {
  key: string;
  label: string;
  ok: boolean;
  /** What the owner needs to do to satisfy this — shown when not ok. */
  hint: string;
  /** Dashboard link that takes the owner to where they fix it. */
  href?: string;
}

export interface Readiness {
  ready: boolean;
  checks: ReadinessCheck[];
}

/**
 * Compute a course's go-live readiness. Makes one Stripe API call (to confirm
 * the connected account can actually receive transfers), so call it from setup
 * surfaces (Settings, the goLive action) — not on every dashboard render.
 */
export async function getCourseReadiness(course: Course): Promise<Readiness> {
  const [activeLayouts, teeSlotCount] = await Promise.all([
    prisma.layout.findMany({
      where: { courseId: course.id, isActive: true },
      select: { id: true, pricing: { select: { id: true } } },
    }),
    prisma.teeTimeSlot.count({
      where: { isActive: true, layout: { courseId: course.id, isActive: true } },
    }),
  ]);

  const hasLayout = activeLayouts.length > 0;
  const hasPricing = activeLayouts.some((l) => l.pricing);
  const hasTeeTimes = teeSlotCount > 0;
  const stripeVerified = Boolean(course.stripeAccountId && course.stripeOnboarded);

  // The connected account must actually have the `transfers` capability active,
  // or every booking's destination charge fails at payment time. Only worth
  // an API call once Stripe is otherwise connected + verified.
  let transfersOk = false;
  if (stripeVerified) {
    try {
      const account = await getStripe().accounts.retrieve(course.stripeAccountId!);
      transfersOk = account.capabilities?.transfers === "active";
    } catch {
      transfersOk = false;
    }
  }

  const checks: ReadinessCheck[] = [
    {
      key: "layout",
      label: "Course (layout) created",
      ok: hasLayout,
      hint: "Add at least one active course layout.",
      href: "/dashboard/tee-times",
    },
    {
      key: "pricing",
      label: "Green fees set",
      ok: hasPricing,
      hint: "Set your green/cart fees for the layout.",
      href: "/dashboard/pricing",
    },
    {
      key: "teeTimes",
      label: "Tee time schedule added",
      ok: hasTeeTimes,
      hint: "Add a tee time schedule (at least one day with start/end times).",
      href: "/dashboard/tee-times",
    },
    {
      key: "stripe",
      label: "Stripe connected & verified",
      ok: stripeVerified,
      hint: "Connect your Stripe account and finish verification.",
      href: "/dashboard/settings",
    },
    {
      key: "transfers",
      label: "Payouts (transfers) enabled",
      ok: transfersOk,
      hint: "Your Stripe account can't receive transfers yet — finish Stripe verification, then Reconnect Stripe. If it persists, enable the Transfers capability in your Stripe dashboard.",
      href: "/dashboard/settings",
    },
  ];

  return { ready: checks.every((c) => c.ok), checks };
}
