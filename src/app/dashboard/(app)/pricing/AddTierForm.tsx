"use client";

import { useFormState, useFormStatus } from "react-dom";
import { savePricingTier } from "./actions";
import { SaveButton } from "@/app/dashboard/_components/SaveButton";

const inp = "w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none transition focus:border-course focus:ring-2 focus:ring-course/25";
const timeOpts = Array.from({ length: 24 }, (_, i) => ({ val: i, label: `${i === 0 ? 12 : i > 12 ? i - 12 : i}:00 ${i < 12 ? "AM" : "PM"}` }));

interface ActionResult {
  ok: boolean;
  message: string;
}

export function AddTierForm({ layoutId }: { layoutId: string }) {
  const [state, formAction] = useFormState(savePricingTier, { ok: false, message: "" });
  const { pending } = useFormStatus();

  return (
    <form action={formAction} className="mb-4 flex flex-wrap items-end gap-3 rounded-lg bg-black/[0.02] p-4">
      <input type="hidden" name="layoutId" value={layoutId} />
      <label className="block flex-1 min-w-48">
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-foreground/45">Tier name</span>
        <input name="name" required placeholder="Early bird" className={inp} />
      </label>
      <label className="block">
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-foreground/45">Start hour (0–23)</span>
        <select name="startHour" className={inp} defaultValue="6">
          {timeOpts.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-foreground/45">End hour (0–23)</span>
        <select name="endHour" className={inp} defaultValue="10">
          {timeOpts.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-foreground/45">Price ($)</span>
        <input name="fee" type="number" step="0.01" required placeholder="45.00" className={`${inp} w-24`} />
      </label>
      <label className="block">
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-foreground/45">Apply to</span>
        <select name="applyTo" className={inp}>
          <option value="both">Both days</option>
          <option value="weekday">Weekdays</option>
          <option value="weekend">Weekends</option>
        </select>
      </label>
      <SaveButton label="Add tier" pending={pending} state={state} />
    </form>
  );
}
