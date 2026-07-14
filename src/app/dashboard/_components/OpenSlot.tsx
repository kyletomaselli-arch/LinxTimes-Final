"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createWalkIn } from "../actions";
import { formatTimeLabel } from "@/lib/datetime";

/**
 * An open tee time in the calendar. Click to drop in a quick walk-in/phone
 * booking, prefilled with this slot's layout, date, and time.
 */
export function OpenSlot({
  layoutId,
  date,
  time,
}: {
  layoutId: string;
  date: string;
  time: string;
}) {
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("layoutId", layoutId);
    fd.set("date", date);
    fd.set("slotTime", time);
    startTransition(async () => {
      const res = await createWalkIn(fd);
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setErr(res.message);
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); setErr(null); }}
        className="flex h-full w-full items-center justify-center rounded-[11px] border border-dashed border-black/10 text-xs text-foreground/30 transition hover:border-linx-green hover:bg-linx-green/[0.04] hover:text-linx-green"
      >
        + open
      </button>
    );
  }

  return (
    <div className="relative">
      <form onSubmit={submit} className="absolute left-0 top-0 z-20 w-56 rounded-xl border border-black/10 bg-white p-3 shadow-xl">
        <div className="mb-2 text-xs font-semibold text-foreground/70">Add booking · {formatTimeLabel(time)}</div>
        <input name="golferName" required placeholder="Golfer name" className="w-full rounded-lg border border-black/10 px-2.5 py-1.5 text-xs outline-none focus:border-linx-green" />
        <div className="mt-2 flex gap-2">
          <select name="numPlayers" className="flex-1 rounded-lg border border-black/10 px-2 py-1.5 text-xs">{[1,2,3,4].map(n=><option key={n} value={n}>{n} players</option>)}</select>
          <select name="holes" className="rounded-lg border border-black/10 px-2 py-1.5 text-xs"><option value="18">18H</option><option value="9">9H</option></select>
        </div>
        <input type="hidden" name="source" value="walkin" />
        {err && <p className="mt-2 text-xs font-medium text-red-600">{err}</p>}
        <div className="mt-2.5 flex gap-2">
          <button disabled={pending} className="flex-1 rounded-full bg-linx-green px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{pending ? "Adding…" : "Add"}</button>
          <button type="button" onClick={() => setOpen(false)} className="rounded-full px-3 py-1.5 text-xs font-medium text-foreground/50 hover:bg-black/[0.04]">Cancel</button>
        </div>
      </form>
    </div>
  );
}
