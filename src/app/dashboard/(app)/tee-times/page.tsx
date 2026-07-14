import { requireCourseAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { toDateKey } from "@/lib/datetime";
import { addLayout, updateLayout, saveSlots, addOverride, blockRange, deleteOverride } from "./actions";

const inp = "rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-sm outline-none transition focus:border-course focus:ring-2 focus:ring-course/25";
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function TeeTimesPage() {
  const { course } = await requireCourseAdmin();
  const [layouts, overrides] = await Promise.all([
    prisma.layout.findMany({
      where: { courseId: course.id },
      include: { teeTimeSlots: true },
      orderBy: { name: "asc" },
    }),
    prisma.dailyOverride.findMany({
      where: { courseId: course.id },
      orderBy: { overrideDate: "asc" },
    }),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-3xl font-semibold text-foreground">Tee Times</h1>

      {/* Add layout */}
      <form action={addLayout} className="mt-6 flex flex-wrap items-end gap-3 rounded-2xl bg-white shadow-[0_18px_40px_-34px_rgba(16,50,34,0.4)] p-5">
        <label className="block"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-foreground/45">New layout name</span><input name="name" required placeholder="The Rock" className={`${inp} w-48`} /></label>
        <label className="block"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-foreground/45">Holes</span><select name="holes" className={inp}><option value="18">18</option><option value="9">9</option></select></label>
        <button className="rounded-full bg-course px-5 py-2 text-sm font-semibold text-course-contrast">Add layout</button>
      </form>

      {layouts.map((l) => {
        const byDay = new Map(l.teeTimeSlots.map((s) => [s.dayOfWeek, s]));
        return (
          <div key={l.id} className="mt-6 rounded-2xl bg-white shadow-[0_18px_40px_-34px_rgba(16,50,34,0.4)] p-5">
            <form action={updateLayout} className="flex flex-wrap items-end gap-3 border-b border-black/5 pb-4">
              <input type="hidden" name="id" value={l.id} />
              <label className="block"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-foreground/45">Layout name</span><input name="name" defaultValue={l.name} className={`${inp} w-48`} /></label>
              <label className="block"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-foreground/45">Holes</span><select name="holes" defaultValue={String(l.holes)} className={inp}><option value="18">18</option><option value="9">9</option></select></label>
              <label className="flex items-center gap-2 pb-1.5 text-sm"><input type="checkbox" name="isActive" defaultChecked={l.isActive} className="h-4 w-4 accent-[var(--course-primary)]" /> Active</label>
              <button className="rounded-full border border-black/10 px-4 py-1.5 text-sm font-medium text-foreground/70 hover:bg-black/[0.04]">Save layout</button>
            </form>

            <form action={saveSlots} className="mt-4">
              <input type="hidden" name="layoutId" value={l.id} />
              <div className="text-[11px] font-semibold uppercase tracking-wide text-foreground/45">Weekly tee time template</div>
              <div className="mt-2 space-y-1.5">
                {DAYS.map((label, day) => {
                  const s = byDay.get(day);
                  return (
                    <div key={day} className="flex flex-wrap items-center gap-2 text-sm">
                      <label className="flex w-24 items-center gap-2"><input type="checkbox" name={`active_${day}`} defaultChecked={s?.isActive ?? true} className="h-4 w-4 accent-[var(--course-primary)]" /> {label}</label>
                      <input name={`start_${day}`} defaultValue={s?.startTime ?? "07:00"} className={`${inp} w-24`} />
                      <span className="text-foreground/40">to</span>
                      <input name={`end_${day}`} defaultValue={s?.endTime ?? "18:00"} className={`${inp} w-24`} />
                      <span className="text-foreground/40">every</span>
                      <input name={`interval_${day}`} type="number" min={5} max={60} defaultValue={s?.intervalMin ?? 10} className={`${inp} w-16`} />
                      <span className="text-foreground/40">min · max</span>
                      <input name={`max_${day}`} type="number" min={1} max={6} defaultValue={s?.maxPlayers ?? 4} className={`${inp} w-14`} />
                    </div>
                  );
                })}
              </div>
              <button className="mt-3 rounded-full bg-course px-5 py-2 text-sm font-semibold text-course-contrast">Save tee times for {l.name}</button>
            </form>
          </div>
        );
      })}

      {/* Daily overrides */}
      <div className="mt-6 rounded-2xl bg-white shadow-[0_18px_40px_-34px_rgba(16,50,34,0.4)] p-5">
        <h2 className="font-display text-lg font-semibold text-foreground">Daily overrides</h2>
        <p className="mt-1 text-sm text-foreground/55">Close the whole day (leave time blank) or a specific tee time — e.g. a tournament.</p>
        <form action={addOverride} className="mt-3 flex flex-wrap items-end gap-3">
          <label className="block"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-foreground/45">Date</span><input name="date" type="date" required className={inp} /></label>
          <label className="block"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-foreground/45">Time (optional)</span><input name="slotTime" placeholder="HH:MM" className={`${inp} w-24`} /></label>
          <label className="block flex-1"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-foreground/45">Reason</span><input name="reason" placeholder="Tournament" className={`${inp} w-full`} /></label>
          <button className="rounded-full bg-course px-5 py-2 text-sm font-semibold text-course-contrast">Add closure</button>
        </form>

        <p className="mt-5 text-sm font-medium text-foreground/70">Block a time range (tournament / outing)</p>
        <form action={blockRange} className="mt-2 flex flex-wrap items-end gap-3">
          <label className="block"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-foreground/45">Date</span><input name="date" type="date" required className={inp} /></label>
          <label className="block"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-foreground/45">From</span><input name="start" type="time" required className={`${inp} w-28`} /></label>
          <label className="block"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-foreground/45">To</span><input name="end" type="time" required className={`${inp} w-28`} /></label>
          <label className="block flex-1"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-foreground/45">Reason</span><input name="reason" placeholder="Member-Guest tournament" className={`${inp} w-full`} /></label>
          <button className="rounded-full bg-course px-5 py-2 text-sm font-semibold text-course-contrast">Block range</button>
        </form>

        {overrides.length > 0 && (
          <div className="mt-4 space-y-1.5">
            {overrides.map((o) => (
              <div key={o.id} className="flex items-center justify-between rounded-lg bg-black/[0.02] px-3 py-2 text-sm">
                <span>
                  <span className="font-medium">{toDateKey(o.overrideDate)}</span>
                  {o.slotTime ? ` · ${o.slotTime}` : " · full day"}
                  {o.reason ? ` — ${o.reason}` : ""}
                </span>
                <form action={deleteOverride}>
                  <input type="hidden" name="id" value={o.id} />
                  <button className="rounded-full border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50">Remove</button>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
