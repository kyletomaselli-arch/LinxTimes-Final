import { requireCourseAdmin } from "@/lib/session";
import { DarkSidebar } from "../_components/DarkSidebar";
import { MobileTabBar } from "../_components/MobileTabBar";
import { DashboardSearch } from "../_components/DashboardSearch";
import { AccountMenu } from "../_components/AccountMenu";
import { GoLiveButton } from "./_components/GoLiveButton";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { course, admin } = await requireCourseAdmin();

  return (
    <div className="flex min-h-screen bg-[#f6f7f9]">
      <DarkSidebar courseName={course.name} logoUrl={course.logoUrl} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* top bar */}
        <div className="flex items-center gap-4 border-b border-black/[0.06] bg-white px-4 py-3.5 sm:px-7">
          <DashboardSearch />
          <div className="ml-auto flex items-center gap-3">
            <a href={`/${course.slug}`} target="_blank" rel="noreferrer" className="hidden rounded-full px-3 py-1.5 text-xs font-medium text-foreground/55 transition hover:bg-black/[0.04] sm:block">View page ↗</a>
            <AccountMenu name={admin.name} role={admin.role} />
          </div>
        </div>

        {course.status !== "active" && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-7 py-2.5">
            <p className="text-sm text-amber-900"><span className="font-semibold">Your course isn&apos;t live yet.</span> Finish setup in <a href="/dashboard/settings" className="underline">Settings</a>, then go live.</p>
            <GoLiveButton />
          </div>
        )}

        <main className="min-w-0 flex-1 p-4 pb-24 sm:p-7 md:pb-7">{children}</main>
      </div>

      <MobileTabBar />
    </div>
  );
}
