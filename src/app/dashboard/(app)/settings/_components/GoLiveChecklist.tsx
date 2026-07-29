import { getCourseReadiness } from "@/lib/readiness";
import type { Course } from "@/generated/prisma";

/**
 * Setup checklist shown on Settings while a course isn't live yet. Mirrors the
 * exact checks the goLive action enforces, so the owner can see — and fix —
 * everything that's blocking go-live before clicking the button.
 */
export async function GoLiveChecklist({ course }: { course: Course }) {
  const { ready, checks } = await getCourseReadiness(course);

  return (
    <div className="mt-6 rounded-2xl bg-white shadow-[0_18px_40px_-34px_rgba(16,50,34,0.4)] p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-foreground">Go-live checklist</h2>
        <span
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
            ready ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${ready ? "bg-green-600" : "bg-amber-500"}`} />
          {ready ? "Ready to go live" : "Setup incomplete"}
        </span>
      </div>
      <p className="mt-1 text-sm text-foreground/55">
        Your public booking page opens once every step below is done. Use the{" "}
        <span className="font-medium">Go live</span> banner at the top once everything is green.
      </p>

      <ul className="mt-4 space-y-2.5">
        {checks.map((c) => (
          <li key={c.key} className="flex items-start gap-3">
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                c.ok ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
              }`}
              aria-hidden
            >
              {c.ok ? "✓" : "!"}
            </span>
            <div className="min-w-0">
              <p className={`text-sm font-medium ${c.ok ? "text-foreground" : "text-foreground/80"}`}>
                {c.label}
              </p>
              {!c.ok && (
                <p className="text-xs text-foreground/55">
                  {c.hint}
                  {c.href && (
                    <>
                      {" "}
                      <a href={c.href} className="font-medium text-linx-green underline">
                        Fix now
                      </a>
                    </>
                  )}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
