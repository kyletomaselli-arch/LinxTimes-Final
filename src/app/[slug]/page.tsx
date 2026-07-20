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
        {/* Branded hero — the course's own photo when one is uploaded,
            otherwise the aurora treatment. */}
        {course.heroImageUrl ? (
          <header className="animate-fade-up">
            <div className="relative h-60 overflow-hidden rounded-[26px] shadow-[0_32px_84px_-34px_rgba(13,53,34,0.55)] sm:h-80">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={course.heroImageUrl}
                alt={`${course.name} course`}
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 flex items-center gap-4 p-6 sm:p-8">
                {course.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={course.logoUrl}
                    alt={`${course.name} logo`}
                    className="h-14 w-14 rounded-2xl bg-white object-contain p-1.5 shadow-md sm:h-16 sm:w-16"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white font-display text-2xl font-semibold text-course shadow-md sm:h-16 sm:w-16">
                    {course.name.slice(0, 1)}
                  </div>
                )}
                <div>
                  <h1 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl [text-shadow:0_1px_12px_rgba(0,20,8,0.6)]">
                    {course.name}
                  </h1>
                  <p className="mt-1 text-sm text-white/85">
                    {[course.city, course.state].filter(Boolean).join(", ") || "Now booking"}
                  </p>
                </div>
              </div>
            </div>
          </header>
        ) : (
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
        )}

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

        {/* Course contact — built from Settings fields; hidden when none are set. */}
        {(course.phone || course.address || course.website) && (
          <div className="mt-8 rounded-2xl bg-white/70 px-6 py-4 shadow-sm ring-1 ring-black/5 backdrop-blur-sm animate-fade-up">
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm text-foreground/70">
              {course.phone && (
                <a href={`tel:${course.phone.replace(/[^0-9+]/g, "")}`} className="flex items-center gap-2 font-medium transition hover:text-course">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                  {course.phone}
                </a>
              )}
              {course.address && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent([course.name, course.address, course.city, course.state, course.zip].filter(Boolean).join(", "))}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 font-medium transition hover:text-course"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0 1 18 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                  {[course.address, course.city].filter(Boolean).join(", ")}
                  <span className="font-semibold text-course">Directions</span>
                </a>
              )}
              {course.website && (
                <a
                  href={course.website.startsWith("http") ? course.website : `https://${course.website}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 font-medium transition hover:text-course"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
                  {course.website.replace(/^https?:\/\//, "")}
                </a>
              )}
            </div>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-foreground/50">
          Powered by <span className="font-semibold text-course">LinxTimes</span>
        </p>
      </div>
    </main>
  );
}
