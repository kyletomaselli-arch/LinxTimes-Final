import { notFound } from "next/navigation";
import { requireActiveCourse } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { courseThemeStyle } from "@/lib/theme";
import { todayKeyInTz } from "@/lib/datetime";
import { AuroraBackground } from "@/components/AuroraBackground";
import { BookingFlow } from "./BookingFlow";
import type { Metadata } from "next";

export async function generateMetadata(
  props: PageProps<"/[slug]">
): Promise<Metadata> {
  const { slug } = await props.params;
  const course = await prisma.course.findUnique({
    where: { slug: slug.toLowerCase() },
    select: { name: true, city: true, state: true, status: true },
  });
  // Signal not-found here too so the response commits a real 404 status
  // (not a soft 404) for unknown or not-yet-live courses.
  if (!course || course.status !== "active") notFound();
  return {
    title: `Book a tee time — ${course.name}`,
    description: `Reserve your tee time at ${course.name}${
      course.city ? `, ${course.city}` : ""
    }${course.state ? `, ${course.state}` : ""}.`,
  };
}

export default async function CourseBookingPage(props: PageProps<"/[slug]">) {
  const { slug } = await props.params;
  const course = await requireActiveCourse(slug);

  const layouts = await prisma.layout.findMany({
    where: { courseId: course.id, isActive: true },
    include: { pricing: true },
    orderBy: { name: "asc" },
  });

  const themeStyle = courseThemeStyle(course.primaryColor, course.secondaryColor);
  const today = todayKeyInTz(course.timezone);

  return (
    <main id="main-content" style={themeStyle} className="relative min-h-screen">
      <AuroraBackground />

      <div className="relative z-10 mx-auto max-w-5xl px-5 pt-16 pb-24 sm:pt-20">
        {/* Branded hero */}
        <header className="animate-fade-up">
          <div className="flex items-center gap-3">
            <span
              className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium text-course backdrop-blur-sm"
              style={{
                borderColor: "color-mix(in srgb, var(--course-primary) 25%, transparent)",
                background: "rgba(255,255,255,0.65)",
              }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-course" />
              {[course.city, course.state].filter(Boolean).join(", ") || "Now booking"}
            </span>
          </div>

          <div className="mt-5 flex items-center gap-4">
            {course.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={course.logoUrl}
                alt={`${course.name} logo`}
                className="h-16 w-16 rounded-2xl bg-white object-contain p-2 shadow-md ring-1 ring-black/5"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white font-display text-2xl font-semibold text-course shadow-md ring-1 ring-black/5">
                {course.name.slice(0, 1)}
              </div>
            )}
            <div>
              <h1 className="font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                {course.name}
              </h1>
            </div>
          </div>
          <p className="mt-4 max-w-xl text-lg text-foreground/60">
            Reserve your tee time in seconds. Sunlit fairways, zero hassle — no
            account required.
          </p>
        </header>

        {course.announcement && (
          <div
            role="status"
            className="mt-8 flex items-start gap-3 rounded-2xl border px-5 py-4 shadow-sm backdrop-blur-sm animate-fade-up lx-glass"
            style={{
              borderColor: "color-mix(in srgb, var(--course-primary) 22%, transparent)",
              background: "color-mix(in srgb, var(--course-primary) 7%, rgba(255,255,255,0.72))",
            }}
          >
            <span
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-course"
              style={{ background: "color-mix(in srgb, var(--course-primary) 15%, transparent)" }}
              aria-hidden="true"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 11v3a1 1 0 0 0 1 1h2l3.5 4V6L6 10H4a1 1 0 0 0-1 1Z" /><path d="M16 8a5 5 0 0 1 0 8" />
              </svg>
            </span>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-course/70">Course update</div>
              <p className="mt-0.5 text-sm font-medium leading-relaxed text-foreground/80">{course.announcement}</p>
            </div>
          </div>
        )}

        {/* Booking flow panel — frosted glass over the aurora */}
        <div className="mt-10 overflow-hidden rounded-[26px] shadow-[0_32px_84px_-34px_rgba(13,53,34,0.42)] lx-glass animate-fade-up">
          <BookingFlow
            slug={course.slug}
            today={today}
            maxDaysAhead={course.maxDaysAhead}
            layouts={layouts.map((l) => ({
              id: l.id,
              name: l.name,
              holes: l.holes,
              cartAvailable: l.pricing?.cartAvailable ?? false,
            }))}
          />
        </div>

        <p className="mt-6 text-center text-xs text-foreground/50">
          Powered by <span className="font-semibold text-course">LinxTimes</span>
        </p>
      </div>
    </main>
  );
}
