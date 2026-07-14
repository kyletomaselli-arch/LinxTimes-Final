"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createWalkIn, adminAvailableSlots } from "../actions";

export interface LayoutOpt {
  id: string;
  name: string;
}

const inp =
  "w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none transition focus:border-course focus:ring-2 focus:ring-course/25";

export function AddWalkInForm({
  layouts,
  today,
  presetLayoutId,
  presetTime,
  presetDate,
}: {
  layouts: LayoutOpt[];
  today: string;
  presetLayoutId?: string;
  presetTime?: string;
  presetDate?: string;
}) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const [layoutId, setLayoutId] = useState(presetLayoutId ?? layouts[0]?.id ?? "");
  const [date, setDate] = useState(presetDate ?? today);
  const [slotTime, setSlotTime] = useState(presetTime ?? "");
  const [slots, setSlots] = useState<{ time: string; label: string }[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Load available times whenever the layout or date changes.
  useEffect(() => {
    if (!open || !layoutId || !date) return;
    let cancelled = false;
    setLoadingSlots(true);
    adminAvailableSlots(layoutId, date)
      .then((s) => {
        if (cancelled) return;
        setSlots(s);
        // Keep a valid selection.
        setSlotTime((prev) => (s.some((x) => x.time === prev) ? prev : s[0]?.time ?? ""));
      })
      .finally(() => !cancelled && setLoadingSlots(false));
    return () => {
      cancelled = true;
    };
  }, [open, layoutId, date]);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createWalkIn(fd);
      setMsg(res.message);
      if (res.ok) {
        setSlotTime("");
        setOpen(false);
        router.refresh();
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); setMsg(null); }}
        className="rounded-full bg-course px-4 py-2 text-sm font-semibold text-course-contrast"
      >
        + Add walk-in / phone
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="w-full rounded-2xl border border-black/5 bg-white p-5 animate-fade-up">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="block sm:col-span-2"><span className={lbl}>Golfer name</span><input name="golferName" required className={inp} /></label>
        <label className="block"><span className={lbl}>Phone</span><input name="golferPhone" className={inp} /></label>
        <label className="block"><span className={lbl}>Source</span><select name="source" className={inp}><option value="walkin">Walk-in</option><option value="phone">Phone</option></select></label>

        <label className="block"><span className={lbl}>Layout</span>
          <select name="layoutId" value={layoutId} onChange={(e) => setLayoutId(e.target.value)} className={inp}>
            {layouts.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
        <label className="block"><span className={lbl}>Date</span>
          <input name="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inp} />
        </label>
        <label className="block"><span className={lbl}>Available time</span>
          <select name="slotTime" value={slotTime} onChange={(e) => setSlotTime(e.target.value)} required className={inp} disabled={loadingSlots || slots.length === 0}>
            {loadingSlots && <option value="">Loading…</option>}
            {!loadingSlots && slots.length === 0 && <option value="">No open times</option>}
            {slots.map((s) => <option key={s.time} value={s.time}>{s.label}</option>)}
          </select>
        </label>
        <label className="block"><span className={lbl}>Players</span><select name="numPlayers" className={inp}>{[1,2,3,4].map((n)=><option key={n} value={n}>{n}</option>)}</select></label>
        <label className="block"><span className={lbl}>Holes</span><select name="holes" className={inp}><option value="18">18</option><option value="9">9</option></select></label>
        <label className="flex items-center gap-2 pt-5 text-sm"><input type="checkbox" name="withCart" className="h-4 w-4 accent-[var(--course-primary)]" /> Cart</label>
      </div>
      {msg && <p className="mt-3 text-sm font-medium text-red-600">{msg}</p>}
      <div className="mt-4 flex gap-2">
        <button disabled={pending || !slotTime} className="rounded-full bg-course px-5 py-2 text-sm font-semibold text-course-contrast disabled:opacity-50">{pending ? "Adding…" : "Add booking"}</button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-full px-4 py-2 text-sm font-medium text-foreground/60 hover:bg-black/[0.04]">Cancel</button>
      </div>
    </form>
  );
}

const lbl = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-foreground/45";
