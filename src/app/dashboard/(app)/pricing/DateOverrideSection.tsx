"use client";

import { useActionState } from "react";
import { setDateOverride, deleteDateOverride, type ActionResult } from "./actions";
import { SaveButton } from "@/app/dashboard/_components/SaveButton";

const inp = "w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none transition focus:border-course focus:ring-2 focus:ring-course/25";
const init: ActionResult = { ok: false, message: "" };

export interface DateOverrideRow {
  id: string;
  overrideDate: Date;
  feeCents: number;
  reason: string | null;
}

export function DateOverrideSection({ overrides }: { overrides: DateOverrideRow[] }) {
  const [state, action, pending] = useActionState(setDateOverride, init);

  return (
    <div className="mt-6 rounded-2xl bg-white shadow-[0_18px_40px_-34px_rgba(16,50,34,0.4)] p-5">
      <h2 className="font-display text-lg font-semibold text-foreground">One-day pricing</h2>
      <p className="mt-1 text-sm text-foreground/55">Set a flat green fee for a single date — a holiday, a tournament, anything that needs a different price than the regular schedule for that one day.</p>

      <form action={action} className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-foreground/45">Date</span><input name="date" type="date" required className={`${inp} w-40`} /></label>
        <label className="block"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-foreground/45">Price ($)</span>
          <div className="relative w-28">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40 text-sm">$</span>
            <input name="fee" inputMode="decimal" required placeholder="85.00" className={`${inp} pl-6`} />
          </div>
        </label>
        <label className="block flex-1 min-w-40"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-foreground/45">Reason (optional)</span><input name="reason" placeholder="July 4th holiday rate" className={inp} /></label>
        <SaveButton label="Set price" pending={pending} state={state} />
      </form>

      {overrides.length > 0 && (
        <div className="mt-4 space-y-2">
          {overrides.map((o) => (
            <div key={o.id} className="flex items-center justify-between rounded-lg bg-black/[0.02] px-3 py-2">
              <div className="text-sm">
                <span className="font-medium">{o.overrideDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })}</span>
                <span className="ml-2 text-foreground/60">${(o.feeCents / 100).toFixed(2)}</span>
                {o.reason && <span className="ml-2 text-foreground/45 text-xs">{o.reason}</span>}
              </div>
              <form action={deleteDateOverride}>
                <input type="hidden" name="overrideId" value={o.id} />
                <button type="submit" className="text-xs text-red-600 hover:text-red-700 font-medium">Remove</button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
