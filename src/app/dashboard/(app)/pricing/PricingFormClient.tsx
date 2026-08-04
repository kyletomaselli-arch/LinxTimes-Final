"use client";

import { useFormState, useFormStatus } from "react-dom";
import { updatePricing, deletePricingTier } from "./actions";
import { SaveButton } from "@/app/dashboard/_components/SaveButton";
import { AddTierForm } from "./AddTierForm";

const inp = "w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none transition focus:border-course focus:ring-2 focus:ring-course/25";
const timeOpts = Array.from({ length: 24 }, (_, i) => ({ val: i, label: `${i === 0 ? 12 : i > 12 ? i - 12 : i}:00 ${i < 12 ? "AM" : "PM"}` }));

function dollars(cents: number | undefined): string {
  return cents != null ? (cents / 100).toFixed(2) : "";
}

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
    memberFee?: number;
    cartFee?: number;
    cartAvailable?: boolean;
    nineHoleDiscount?: boolean;
    twilightEnabled?: boolean;
    tiers?: Array<{
      id: string;
      name: string;
      startHour: number;
      endHour: number;
      feeCents: number;
      applyTo: string;
    }>;
  } | null;
}) {
  const [state, formAction] = useFormState(updatePricing, { ok: false, message: "" });
  const { pending } = useFormStatus();

  return (
    <form action={formAction} className="mt-6 rounded-2xl bg-white shadow-[0_18px_40px_-34px_rgba(16,50,34,0.4)] p-5">
      <input type="hidden" name="layoutId" value={layoutId} />
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-foreground">
          {layoutName} <span className="text-sm font-normal text-foreground/50">· {pricing?.memberFee ?? 2500}</span>
        </h2>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Money name="weekdayFee" label="Weekday green fee" v={dollars(pricing?.weekdayFee ?? 5000)} />
        <Money name="weekendFee" label="Weekend green fee" v={dollars(pricing?.weekendFee ?? 7000)} />
        <Money name="twilightFee" label="Twilight (flat)" v={dollars(pricing?.twilightFee ?? 3000)} />
        <div>
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-foreground/45">Twilight start hour (0–23)</span>
          <input name="twilightHour" type="number" min={0} max={23} defaultValue={pricing?.twilightHour ?? 16} className={inp} />
        </div>
        <Money name="memberFee" label="Member green fee" v={dollars(pricing?.memberFee ?? 2500)} />
        <Money name="cartFee" label="Cart fee" v={dollars(pricing?.cartFee ?? 1500)} />
      </div>
      <div className="mt-3 flex flex-wrap gap-5">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="cartAvailable" defaultChecked={pricing?.cartAvailable ?? true} className="h-4 w-4 accent-[var(--course-primary)]" /> Carts available
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="nineHoleDiscount" defaultChecked={pricing?.nineHoleDiscount ?? true} className="h-4 w-4 accent-[var(--course-primary)]" /> 9 holes = half green fee
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="twilightEnabled" defaultChecked={pricing?.twilightEnabled ?? true} className="h-4 w-4 accent-[var(--course-primary)]" /> Twilight pricing
        </label>
      </div>
      <SaveButton label={`Save ${layoutName} pricing`} pending={pending} state={state} />

      {/* Time-based pricing tiers */}
      <div className="mt-6 border-t border-black/5 pt-6">
        <h3 className="font-semibold text-foreground mb-1">Time-based pricing tiers</h3>
        <p className="text-xs text-foreground/60 mb-4">Set different rates for different times of day (e.g., early bird, peak, twilight)</p>

        <AddTierForm layoutId={layoutId} />

        {/* List existing tiers */}
        {pricing?.tiers && pricing.tiers.length > 0 && (
          <div className="space-y-2">
            {pricing.tiers.map((tier) => (
              <div key={tier.id} className="flex items-center justify-between rounded-lg bg-black/[0.02] px-4 py-3">
                <div className="text-sm">
                  <span className="font-medium">{tier.name}</span>
                  <span className="ml-3 text-foreground/60">${(tier.feeCents / 100).toFixed(2)}</span>
                  <span className="ml-3 text-foreground/50 text-xs">
                    {timeOpts[tier.startHour]?.label ?? tier.startHour} – {timeOpts[tier.endHour]?.label ?? tier.endHour}
                  </span>
                  <span className="ml-3 text-foreground/50 text-xs">({tier.applyTo})</span>
                </div>
                <form action={deletePricingTier} className="flex items-center gap-2">
                  <input type="hidden" name="tierId" value={tier.id} />
                  <button type="submit" className="text-xs text-red-600 hover:text-red-700 font-medium">Delete</button>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>
    </form>
  );
}

function Money({ name, label, v }: { name: string; label: string; v: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-foreground/45">{label} ($)</span>
      <input name={name} inputMode="decimal" defaultValue={v} className={inp} />
    </label>
  );
}
