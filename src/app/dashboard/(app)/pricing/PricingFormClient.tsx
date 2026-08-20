"use client";

import { useActionState } from "react";
import { updatePricing, type ActionResult } from "./actions";
import { SaveButton } from "@/app/dashboard/_components/SaveButton";

const inp = "w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none transition focus:border-course focus:ring-2 focus:ring-course/25";
const bigInp = "w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-xl font-semibold outline-none transition focus:border-course focus:ring-2 focus:ring-course/25";
const lbl = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-foreground/45";
const timeOpts = Array.from({ length: 24 }, (_, i) => ({ val: i, label: `${i === 0 ? 12 : i > 12 ? i - 12 : i}:00 ${i < 12 ? "AM" : "PM"}` }));

function dollars(cents: number | undefined): string {
  return cents != null ? (cents / 100).toFixed(2) : "";
}

const init: ActionResult = { ok: false, message: "" };

export function PricingFormClient({
  layoutId,
  layoutName,
  pricing,
}: {
  layoutId: string;
  layoutName: string;
  pricing: {
    weekdayFee?: number;
    weekendFee?: number;
    twilightFee?: number;
    twilightHour?: number;
    twilightEnabled?: boolean;
    memberFee?: number;
    cartFee?: number;
    cartAvailable?: boolean;
    nineHoleDiscount?: boolean;
  } | null;
}) {
  const [state, action, pending] = useActionState(updatePricing, init);

  return (
    <form action={action} className="mt-6 rounded-2xl bg-white shadow-[0_18px_40px_-34px_rgba(16,50,34,0.4)] p-5">
      <input type="hidden" name="layoutId" value={layoutId} />
      <h2 className="font-display text-lg font-semibold text-foreground">{layoutName}</h2>
      <p className="mt-1 text-sm text-foreground/55">Set your per-player green fee. These are the only numbers that control what golfers are charged.</p>

      {/* Core rates */}
      <div className="mt-5 grid grid-cols-2 gap-4">
        <label className="block">
          <span className={lbl}>Weekday rate</span>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40">$</span>
            <input name="weekdayFee" inputMode="decimal" defaultValue={dollars(pricing?.weekdayFee ?? 5000)} className={`${bigInp} pl-7`} />
          </div>
        </label>
        <label className="block">
          <span className={lbl}>Weekend rate</span>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40">$</span>
            <input name="weekendFee" inputMode="decimal" defaultValue={dollars(pricing?.weekendFee ?? 7000)} className={`${bigInp} pl-7`} />
          </div>
        </label>
      </div>

      {/* Cart */}
      <div className="mt-5 border-t border-black/5 pt-5">
        <div className="flex items-center justify-between gap-4">
          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            <input type="checkbox" name="cartAvailable" defaultChecked={pricing?.cartAvailable ?? true} className="h-4 w-4 accent-course" />
            Carts available
          </label>
          <label className="flex items-center gap-2">
            <span className="text-xs font-medium text-foreground/60">Cart fee per player</span>
            <div className="relative w-28">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40 text-sm">$</span>
              <input name="cartFee" inputMode="decimal" defaultValue={dollars(pricing?.cartFee ?? 1500)} className={`${inp} pl-6`} />
            </div>
          </label>
        </div>
      </div>

      {/* 9-hole discount */}
      <div className="mt-4 border-t border-black/5 pt-4">
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <input type="checkbox" name="nineHoleDiscount" defaultChecked={pricing?.nineHoleDiscount ?? true} className="h-4 w-4 accent-course" />
          9-hole rounds are half the green fee
        </label>
      </div>

      {/* Twilight */}
      <div className="mt-4 border-t border-black/5 pt-4">
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <input type="checkbox" name="twilightEnabled" defaultChecked={pricing?.twilightEnabled ?? true} className="h-4 w-4 accent-course" />
          Twilight rate
        </label>
        <div className="mt-3 grid grid-cols-2 gap-4">
          <label className="block">
            <span className={lbl}>Starts at</span>
            <select name="twilightHour" defaultValue={pricing?.twilightHour ?? 16} className={inp}>
              {timeOpts.map((o) => <option key={o.val} value={o.val}>{o.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className={lbl}>Flat rate</span>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40 text-sm">$</span>
              <input name="twilightFee" inputMode="decimal" defaultValue={dollars(pricing?.twilightFee ?? 3000)} className={`${inp} pl-6`} />
            </div>
          </label>
        </div>
      </div>

      {/* Member rate */}
      <div className="mt-4 border-t border-black/5 pt-4">
        <label className="block max-w-[200px]">
          <span className={lbl}>Member rate (no override set)</span>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40 text-sm">$</span>
            <input name="memberFee" inputMode="decimal" defaultValue={dollars(pricing?.memberFee ?? 2500)} className={`${inp} pl-6`} />
          </div>
        </label>
      </div>

      <div className="mt-5 border-t border-black/5 pt-5">
        <SaveButton label="Save pricing" pending={pending} state={state} />
      </div>
    </form>
  );
}
