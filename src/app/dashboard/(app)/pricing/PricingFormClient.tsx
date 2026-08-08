"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { updatePricing, savePricingTier, deletePricingTier } from "./actions";
import { SaveButton } from "@/app/dashboard/_components/SaveButton";

const inp = "w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none transition focus:border-course focus:ring-2 focus:ring-course/25";
const timeOpts = Array.from({ length: 24 }, (_, i) => ({ val: i, label: `${i === 0 ? 12 : i > 12 ? i - 12 : i}:00 ${i < 12 ? "AM" : "PM"}` }));

function dollars(cents: number | undefined): string {
  return cents != null ? (cents / 100).toFixed(2) : "";
}

function getTimeLabel(hour: number): string {
  return timeOpts.find(o => o.val === hour)?.label ?? `${hour}:00`;
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
  const [showEdit, setShowEdit] = useState(false);
  const [state, formAction] = useFormState(updatePricing, { ok: false, message: "" });
  const [tierState, tierFormAction] = useFormState(savePricingTier, { ok: false, message: "" });
  const { pending } = useFormStatus();

  const weekdayFee = pricing?.weekdayFee ?? 5000;
  const weekendFee = pricing?.weekendFee ?? 7000;
  const twilightFee = pricing?.twilightFee ?? 3000;
  const twilightHour = pricing?.twilightHour ?? 16;
  const cartFee = pricing?.cartFee ?? 1500;

  const weekdayTiers = (pricing?.tiers ?? []).filter(t => t.applyTo === "weekday" || t.applyTo === "both").sort((a, b) => a.startHour - b.startHour);
  const weekendTiers = (pricing?.tiers ?? []).filter(t => t.applyTo === "weekend" || t.applyTo === "both").sort((a, b) => a.startHour - b.startHour);

  // Build complete schedule including base rates and gaps between tiers
  const buildSchedule = (baseFee: number, tiers: typeof weekdayTiers, isTwilight: boolean) => {
    const schedule: Array<{ start: number; end: number; price: number; label: string; isBase: boolean }> = [];

    if (tiers.length === 0) {
      // No tiers, just base and twilight
      if (isTwilight) {
        schedule.push({ start: 0, end: twilightHour, price: baseFee, label: "Base rate", isBase: true });
        schedule.push({ start: twilightHour, end: 24, price: twilightFee, label: "Twilight", isBase: true });
      } else {
        schedule.push({ start: 0, end: 24, price: baseFee, label: "Base rate", isBase: true });
      }
      return schedule;
    }

    // Start from midnight
    let currentHour = 0;

    // Add segments before, between, and after tiers
    tiers.forEach((tier, i) => {
      // Add base rate gap before this tier
      if (currentHour < tier.startHour) {
        const endHour = tier.startHour;
        const price = isTwilight && currentHour >= twilightHour ? twilightFee : baseFee;
        schedule.push({ start: currentHour, end: endHour, price, label: "Base rate", isBase: true });
        currentHour = endHour;
      }

      // Add the tier itself
      schedule.push({ start: tier.startHour, end: tier.endHour, price: tier.feeCents, label: tier.name, isBase: false });
      currentHour = tier.endHour;
    });

    // Add base rate after last tier
    if (currentHour < 24) {
      const price = isTwilight && currentHour >= twilightHour ? twilightFee : baseFee;
      schedule.push({ start: currentHour, end: 24, price, label: "Base rate", isBase: true });
    }

    return schedule;
  };

  const weekdaySchedule = buildSchedule(weekdayFee, weekdayTiers, pricing?.twilightEnabled ?? true);
  const weekendSchedule = buildSchedule(weekendFee, weekendTiers, pricing?.twilightEnabled ?? true);

  const TimelineItem = ({ time, label, price, isBase }: { time: string; label?: string; price: number; isBase?: boolean }) => (
    <div className="flex items-center justify-between rounded-lg bg-black/[0.02] px-4 py-3 border-l-4 border-course">
      <div>
        <div className="text-sm font-medium text-foreground">{time}</div>
        {label && <div className="text-xs text-foreground/60 mt-0.5">{label}</div>}
      </div>
      <div className="flex items-center gap-2">
        <div className="text-lg font-semibold text-course">${(price / 100).toFixed(2)}</div>
        {!isBase && <span className="text-xs bg-course/10 text-course px-2 py-1 rounded">Tier</span>}
      </div>
    </div>
  );

  return (
    <div className="mt-6 rounded-2xl bg-white shadow-[0_18px_40px_-34px_rgba(16,50,34,0.4)] p-5">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-lg font-semibold text-foreground">{layoutName}</h2>
        <button onClick={() => setShowEdit(!showEdit)} className="text-sm font-semibold text-course hover:text-course/80">
          {showEdit ? "Hide" : "Edit"} Pricing
        </button>
      </div>

      {!showEdit ? (
        <>
          {/* TIMELINE VIEW - READ ONLY */}
          <div className="space-y-6">
            {/* WEEKDAY RATES */}
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-foreground/45 mb-3">Weekday Rates</div>
              <div className="space-y-2">
                {weekdaySchedule.map((slot, i) => (
                  <TimelineItem key={i} time={`${getTimeLabel(slot.start)} – ${slot.end === 24 ? "Close" : getTimeLabel(slot.end)}`} label={slot.label} price={slot.price} isBase={slot.isBase} />
                ))}
              </div>
            </div>

            {/* WEEKEND RATES */}
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-foreground/45 mb-3">Weekend Rates</div>
              <div className="space-y-2">
                {weekendSchedule.map((slot, i) => (
                  <TimelineItem key={i} time={`${getTimeLabel(slot.start)} – ${slot.end === 24 ? "Close" : getTimeLabel(slot.end)}`} label={slot.label} price={slot.price} isBase={slot.isBase} />
                ))}
              </div>
            </div>

            {/* OPTIONS */}
            <div className="border-t border-black/5 pt-4">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-foreground/45 mb-3">Options</div>
              <div className="space-y-2 text-sm text-foreground/70">
                <div className="flex justify-between">
                  <span>Carts available</span>
                  <span className="font-medium text-foreground">{pricing?.cartAvailable ? "Yes" : "No"}</span>
                </div>
                <div className="flex justify-between">
                  <span>9-hole discount</span>
                  <span className="font-medium text-foreground">{pricing?.nineHoleDiscount ? "50%" : "None"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cart fee</span>
                  <span className="font-medium text-foreground">${(cartFee / 100).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* EDIT FORM - ONLY SHOWN WHEN showEdit IS TRUE */}
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="layoutId" value={layoutId} />

            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-foreground/45 mb-3">Base Rates</div>
              <div className="grid grid-cols-2 gap-3">
                <Money name="weekdayFee" label="Weekday" v={dollars(weekdayFee)} />
                <Money name="weekendFee" label="Weekend" v={dollars(weekendFee)} />
              </div>
            </div>

            <div className="border-t border-black/5 pt-4">
              <div className="mb-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="twilightEnabled" defaultChecked={pricing?.twilightEnabled ?? true} className="h-4 w-4 accent-[var(--course-primary)]" />
                  <span>Twilight pricing</span>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Money name="twilightFee" label="Twilight price" v={dollars(twilightFee)} />
                <div>
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-foreground/45">Starts at</span>
                  <input name="twilightHour" type="number" min={0} max={23} defaultValue={twilightHour} className={inp} />
                </div>
              </div>
            </div>

            <div className="border-t border-black/5 pt-4">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-foreground/45 mb-3">Options</div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="cartAvailable" defaultChecked={pricing?.cartAvailable ?? true} className="h-4 w-4 accent-[var(--course-primary)]" />
                  Carts available
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="nineHoleDiscount" defaultChecked={pricing?.nineHoleDiscount ?? true} className="h-4 w-4 accent-[var(--course-primary)]" />
                  9 holes = half green fee
                </label>
              </div>
              <div className="mt-3">
                <Money name="cartFee" label="Cart fee" v={dollars(cartFee)} />
              </div>
            </div>

            <SaveButton label={`Save ${layoutName} pricing`} pending={pending} state={state} />
          </form>

          {/* TIME-BASED TIERS SECTION */}
          <div className="mt-6 border-t border-black/5 pt-6">
            <h3 className="font-semibold text-foreground mb-1">Time-based tiers</h3>
            <p className="text-xs text-foreground/60 mb-4">Add special rates for specific times of day (overrides base rates)</p>

            <form action={tierFormAction} className="mb-4 space-y-3 rounded-lg bg-black/[0.02] p-4">
              <input type="hidden" name="layoutId" value={layoutId} />
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-foreground/45 mb-1">Tier name</label>
                <input name="name" required placeholder="Early bird" className={inp} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-foreground/45 mb-1">Start hour</label>
                  <select name="startHour" className={inp} required>
                    <option value="">Select start time...</option>
                    {timeOpts.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-foreground/45 mb-1">End hour</label>
                  <select name="endHour" className={inp} required>
                    <option value="">Select end time...</option>
                    {timeOpts.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-foreground/45 mb-1">Price ($)</label>
                  <input name="fee" type="number" step="0.01" required placeholder="45.00" className={inp} />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-foreground/45 mb-1">Apply to</label>
                  <select name="applyTo" className={inp}>
                    <option value="both">Both days</option>
                    <option value="weekday">Weekdays</option>
                    <option value="weekend">Weekends</option>
                  </select>
                </div>
              </div>
              <button className="rounded-full bg-course px-5 py-2 text-sm font-semibold text-course-contrast">Add tier</button>
            </form>

            {pricing?.tiers && pricing.tiers.length > 0 && (
              <div className="space-y-2">
                {pricing.tiers.map((tier) => (
                  <div key={tier.id} className="flex items-center justify-between rounded-lg bg-black/[0.02] px-4 py-3">
                    <div className="text-sm">
                      <span className="font-medium">{tier.name}</span>
                      <span className="ml-3 text-foreground/60">${(tier.feeCents / 100).toFixed(2)}</span>
                      <span className="ml-3 text-foreground/50 text-xs">
                        {getTimeLabel(tier.startHour)} – {getTimeLabel(tier.endHour)}
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
        </>
      )}
    </div>
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
