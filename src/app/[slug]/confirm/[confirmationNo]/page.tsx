import { notFound } from "next/navigation";
import { requireActiveCourse } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { courseThemeStyle } from "@/lib/theme";
import { formatCentsCompact } from "@/lib/money";
import { formatTimeLabel, toDateKey, teeTimeEpochMs } from "@/lib/datetime";
import { AuroraBackground } from "@/components/AuroraBackground";
import type { Metadata } from "next";

/** Build a Google Calendar "add event" link for the tee time (4-hour block). */
function calendarUrl(opts: {
  courseName: string;
  layoutName: string;
  dateKey: string;
  slotTime: string;
  timezone: string;
  confirmationNo: string;
  address: string | null;
}): string {
  const start = teeTimeEpochMs(opts.dateKey, opts.slotTime, opts.timezone);
  const end = start + 4 * 60 * 60 * 1000;
  const fmt = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Tee time — ${opts.courseName}`,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: `${opts.layoutName}\nConfirmation ${opts.confirmationNo}`,
    location: opts.address ?? opts.courseName,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export async function generateMetadata(
  props: PageProps<"/[slug]/confirm/[confirmationNo]">
): Promise<Metadata> {
  const { slug, confirmationNo } = await props.params;
  const course = await prisma.course.findUnique({
    where: { slug: slug.toLowerCase() },
    select: { id: true, status: true },
  });
  if (!course || course.status !== "active") notFound();
  const exists = await prisma.booking.findFirst({
    where: { confirmationNo, courseId: course.id },
    select: { id: true },
  });
  if (!exists) notFound();
  return { title: "Booking confirmed — LinxTimes" };
}

export default async function ConfirmationPage(
  props: PageProps<"/[slug]/confirm/[confirmationNo]">
) {
  const { slug, confirmationNo } = await props.params;
  const course = await requireActiveCourse(slug);

  const booking = await prisma.booking.findFirst({
    where: { confirmationNo, courseId: course.id },
    include: { layout: true },
  });
  if (!booking) notFound();

  const themeStyle = courseThemeStyle(course.primaryColor, course.secondaryColor);
  const addressStr = [course.address, course.city, course.state, course.zip].filter(Boolean).join(", ");
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    [course.name, addressStr].filter(Boolean).join(", ")
  )}`;
  const paid = booking.paymentStatus === "paid_online";
  const payAtCourse = booking.paymentStatus === "pay_at_course";
  const pending = booking.paymentStatus === "unpaid";

  return (
    <main
      style={themeStyle}
      className="relative flex min-h-screen items-center justify-center px-5 py-12"
    >
      <AuroraBackground />
      <div className="relative z-10 w-full max-w-md animate-fade-up rounded-2xl p-7 shadow-[0_32px_84px_-34px_rgba(13,53,34,0.42)] lx-glass">
        <div className="flex flex-col items-center text-center">
          <div className="lx-pop flex h-16 w-16 items-center justify-center rounded-full bg-course/10">
            <CheckCircle />
          </div>
          <h1 className="mt-4 font-display text-2xl font-semibold text-course">
            {pending ? "Almost there" : "You're booked!"}
          </h1>
          <p className="mt-1.5 text-sm text-foreground/60">
            {pending
              ? "We're confirming your payment. This page will reflect it shortly."
              : payAtCourse
                ? "Your tee time is reserved. Pay at the course when you arrive."
                : "A confirmation email is on its way."}
          </p>
        </div>

        <div className="my-6 rounded-xl bg-course/5 px-4 py-3 text-center ring-1 ring-course/10">
          <div className="text-xs font-semibold uppercase tracking-wide text-foreground/45">
            Confirmation number
          </div>
          <div className="mt-1 font-mono text-sm font-semibold text-course break-all">
            {booking.confirmationNo}
          </div>
        </div>

        <dl className="space-y-2.5 text-sm">
          <Row label="Course" value={course.name} />
          {addressStr && <Row label="Address" value={addressStr} />}
          <Row label="Layout" value={booking.layout.name} />
          <Row label="Date" value={toDateKey(booking.bookingDate)} />
          <Row label="Time" value={formatTimeLabel(booking.slotTime)} />
          <Row
            label="Players"
            value={`${booking.numPlayers} · ${booking.holes} holes · ${booking.withCart ? "cart" : "walking"}${
              booking.memberCount > 0 ? ` · ${booking.memberCount} member${booking.memberCount === 1 ? "" : "s"}` : ""
            }`}
          />
          <Row label="Golfer" value={booking.golferName} />
          <div className="my-3 h-px bg-black/5" />
          <Row label="Green fee" value={formatCentsCompact(booking.greenFeeCents)} />
          {booking.cartFeeCents > 0 && (
            <Row label="Cart fee" value={formatCentsCompact(booking.cartFeeCents)} />
          )}
          {booking.discountCents > 0 && (
            <Row label={`Discount${booking.promoCode ? ` (${booking.promoCode})` : ""}`} value={`−${formatCentsCompact(booking.discountCents)}`} />
          )}
          {booking.creditCents > 0 && (
            <Row label={`Rain check${booking.rainCheckCode ? ` (${booking.rainCheckCode})` : ""}`} value={`−${formatCentsCompact(booking.creditCents)}`} />
          )}
          {booking.bookingFeeCents + booking.taxCents > 0 && (
            <Row label="Taxes & fees" value={formatCentsCompact(booking.bookingFeeCents + booking.taxCents)} />
          )}
          <Row
            label={payAtCourse ? "Due at course" : paid ? "Paid" : "Total"}
            value={formatCentsCompact(booking.totalCents)}
            strong
          />
        </dl>

        <a
          href={calendarUrl({
            courseName: course.name,
            layoutName: booking.layout.name,
            dateKey: toDateKey(booking.bookingDate),
            slotTime: booking.slotTime,
            timezone: course.timezone,
            confirmationNo: booking.confirmationNo,
            address: [course.address, course.city, course.state].filter(Boolean).join(", ") || null,
          })}
          target="_blank"
          rel="noreferrer"
          className="mt-6 flex items-center justify-center gap-2 rounded-full border border-course/20 bg-course/[0.06] px-5 py-3 text-sm font-semibold text-course transition hover:bg-course/10"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
          Add to calendar
        </a>

        <a
          href={directionsUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 flex items-center justify-center gap-2 rounded-full border border-course/20 bg-course/[0.06] px-5 py-3 text-sm font-semibold text-course transition hover:bg-course/10"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0 1 18 0Z" /><circle cx="12" cy="10" r="3" />
          </svg>
          Get directions
        </a>

        <p className="mt-6 text-center text-xs text-foreground/40">
          Powered by <span className="font-semibold text-course">LinxTimes</span>
        </p>
      </div>
    </main>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-foreground/55">{label}</dt>
      <dd
        className={
          strong ? "font-display text-lg font-semibold text-course" : "font-medium"
        }
      >
        {value}
      </dd>
    </div>
  );
}

function CheckCircle() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
        stroke="var(--course-primary)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
