import { requireCourseAdmin } from "@/lib/session";
import { DarkSidebar } from "../_components/DarkSidebar";
import { goLive } from "../actions";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { course } = await requireCourseAdmin();

  return (
    <div className="flex min-h-screen bg-[#f6f7f9]">
      <DarkSidebar courseName={course.name} logoUrl={course.logoUrl} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* top bar */}
        <div className="flex items-center gap-4 border-b border-black/[0.06] bg-white px-7 py-3.5">
          <div className="w-full max-w-sm rounded-[10px] bg-[#f2f4f7] px-4 py-2 text-sm text-foreground/40">Search bookings, members…</div>
          <div className="ml-auto flex items-center gap-3">
            <a href={`/${course.slug}`} target="_blank" rel="noreferrer" className="rounded-full px-3 py-1.5 text-xs font-medium text-foreground/55 transition hover:bg-black/[0.04]">View page ↗</a>
            <div className="h-8 w-8 rounded-full bg-[#dfe3e8]" />
          </div>
        </div>

        {course.status !== "active" && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-7 py-2.5">
            <p className="text-sm text-amber-900"><span className="font-semibold">Your course isn&apos;t live yet.</span> Finish setup in <a href="/dashboard/settings" className="underline">Settings</a>, then go live.</p>
            <form action={goLive}><button className="rounded-full bg-linx-green px-4 py-1.5 text-xs font-semibold text-white transition hover:brightness-110">Go live</button></form>
          </div>
        )}

        <main className="min-w-0 flex-1 p-7">{children}</main>
      </div>
    </div>
  );
}
