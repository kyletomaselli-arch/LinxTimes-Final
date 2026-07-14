import { requireSuperAdmin } from "@/lib/super-session";
import { prisma } from "@/lib/prisma";
import { WhitelistForm } from "../../_components/WhitelistForm";
import { updateCourse } from "../actions";

const inp = "rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-sm outline-none transition focus:border-linx-green focus:ring-2 focus:ring-linx-green/25";

async function updateCourseForm(formData: FormData) {
  "use server";
  await updateCourse(formData);
}

export default async function CoursesPage() {
  await requireSuperAdmin();
  const courses = await prisma.course.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { bookings: true } } },
  });

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-3xl font-semibold text-foreground">Courses</h1>
      <p className="mt-1 text-sm text-foreground/55">{courses.length} total.</p>

      <div className="mt-6"><WhitelistForm /></div>

      <div className="mt-6 space-y-3">
        {courses.map((c) => (
          <div key={c.id} className="rounded-2xl bg-white p-4 shadow-[0_18px_40px_-34px_rgba(16,50,34,0.4)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-medium">
                  {c.name}{" "}
                  <a href={`/${c.slug}`} target="_blank" rel="noreferrer" className="text-xs font-normal text-foreground/45 underline-offset-2 hover:underline">/{c.slug} ↗</a>
                </div>
                <div className="text-xs text-foreground/50">{c.email ?? "—"} · {c._count.bookings} bookings · Stripe {c.stripeOnboarded ? "ready" : c.stripeAccountId ? "pending" : "not connected"}</div>
              </div>
              <StatusPill status={c.status} />
            </div>
            <form action={updateCourseForm} className="mt-3 flex flex-wrap items-end gap-3 border-t border-black/5 pt-3">
              <input type="hidden" name="courseId" value={c.id} />
              <label className="block"><span className={lbl}>Online fee ($/player)</span><input name="fee" inputMode="decimal" defaultValue={(c.linxtimesFee / 100).toFixed(2)} className={`${inp} w-28`} /></label>
              <label className="block"><span className={lbl}>In-person fee ($/player)</span><input name="inPersonFee" inputMode="decimal" defaultValue={(c.linxtimesInPersonFee / 100).toFixed(2)} className={`${inp} w-28`} /></label>
              <label className="block"><span className={lbl}>Sales tax (%)</span><input name="taxRate" inputMode="decimal" defaultValue={(c.taxRateBps / 100).toFixed(2)} className={`${inp} w-24`} /></label>
              <label className="block"><span className={lbl}>Status</span>
                <select name="status" defaultValue={c.status} className={inp}>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </label>
              <button className="rounded-full border border-black/10 px-4 py-1.5 text-sm font-medium text-foreground/70 hover:bg-black/[0.04]">Save</button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}

const lbl = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-foreground/45";

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-green-100 text-green-800",
    approved: "bg-blue-100 text-blue-800",
    pending: "bg-amber-100 text-amber-800",
    suspended: "bg-red-100 text-red-700",
  };
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${map[status] ?? ""}`}>{status}</span>;
}
