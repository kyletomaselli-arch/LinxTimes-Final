import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCourseBySlug } from "@/lib/tenant";
import { toDateKey, teeTimeEpochMs } from "@/lib/datetime";

/** Escape iCalendar text values (RFC 5545). */
function icsEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/** Epoch ms → iCalendar UTC stamp, e.g. 20260718T130000Z */
function icsStamp(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * GET /[slug]/confirm/[confirmationNo]/ics
 *
 * Downloads the tee time as an .ics calendar file — the "Add to Apple /
 * Outlook calendar" path on the confirmation page (Google gets a link;
 * everyone else speaks iCalendar). 4-hour block, same data as the page.
 */
export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/[slug]/confirm/[confirmationNo]/ics">
) {
  const { slug, confirmationNo } = await ctx.params;
  const course = await getCourseBySlug(slug);
  if (!course || course.status !== "active") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const booking = await prisma.booking.findFirst({
    where: { confirmationNo, courseId: course.id },
    include: { layout: true },
  });
  if (!booking || booking.status === "cancelled") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const start = teeTimeEpochMs(toDateKey(booking.bookingDate), booking.slotTime, course.timezone);
  const end = start + 4 * 60 * 60 * 1000;
  const location = [course.name, course.address, course.city, course.state, course.zip]
    .filter(Boolean)
    .join(", ");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LinxTimes//Tee Time//EN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${icsEscape(booking.confirmationNo)}@linxtimes.com`,
    `DTSTAMP:${icsStamp(Date.now())}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${icsEscape(`Tee time — ${course.name}`)}`,
    `LOCATION:${icsEscape(location)}`,
    `DESCRIPTION:${icsEscape(`${booking.layout.name} · ${booking.numPlayers} player${booking.numPlayers === 1 ? "" : "s"} · ${booking.holes} holes\nConfirmation ${booking.confirmationNo}`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return new NextResponse(lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="tee-time-${booking.confirmationNo}.ics"`,
    },
  });
}
