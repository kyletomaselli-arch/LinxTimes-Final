"use client";

import { useActionState } from "react";
import { saveAllPricing, moveBoundary, splitBand, mergeBand, createFirstBand, type ActionResult } from "./actions";
import { SaveButton } from "@/app/dashboard/_components/SaveButton";

const inp = "w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none transition focus:border-course focus:ring-2 focus:ring-course/25";
const priceInp = "w-full rounded-md border border-black/10 bg-white px-2 py-1.5 text-sm text-center outline-none transition focus:border-course focus:ring-2 focus:ring-course/25";
// border-color can't be set via a Tailwind utility here — globals.css has an
// unlayered `* { border-color: ... }` reset that (per the CSS cascade-layers
// spec) beats every Tailwind border-color utility regardless of specificity.
// Inline style is the only thing that reliably wins.
const priceInpAccent = "w-full rounded-md border-[1.5px] bg-white px-2 py-1.5 text-sm text-center font-medium outline-none transition focus:ring-2 focus:ring-course/25";
const accentBorderStyle = { borderColor: "#12a06f" };
const lbl = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-foreground/45";

function dollars(cents: number | undefined): string {
  return cents != null ? (cents / 100).toFixed(2) : "";
}

function formatHour(h: number): string {
  if (h === 24) return "close";
  const hr = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hr}:00 ${h < 12 ? "AM" : "PM"}`;
}

const init: ActionResult = { ok: false, message: "" };

interface Band {
  id: string;
  startHour: number;
  endHour: number;
  monThuFeeCents: number;
  friFeeCents: number;
  satFeeCents: number;
  sunFeeCents: number;
}

export function PricingFormClient({
  layoutId,
  layoutName,
  pricing,
}: {
  layoutId: string;
  layoutName: string;
  pricing: {
    memberFee?: number;
    cartFee?: number;
    cartAvailable?: boolean;
    nineHoleDiscount?: boolean;
    bands?: Band[];
  } | null;
}) {
  const [saveState, saveAction, savePending] = useActionState(saveAllPricing, init);
  const [moveState, moveAction, movePending] = useActionState(moveBoundary, init);
  const [, splitAction, splitPending] = useActionState(splitBand, init);
  const [, mergeActionFn, mergePending] = useActionState(mergeBand, init);
  const [, firstBandAction, firstBandPending] = useActionState(createFirstBand, init);

  const bands = [...(pricing?.bands ?? [])].sort((a, b) => a.startHour - b.startHour);
  const structPending = movePending || splitPending || mergePending;
  const formId = `pricing-${layoutId}`;

  if (bands.length === 0) {
    return (
      <div className="mt-6 rounded-2xl bg-white shadow-[0_18px_40px_-34px_rgba(16,50,34,0.4)] p-5">
        <h2 className="font-display text-lg font-semibold text-foreground">{layoutName}</h2>
        <p className="mt-2 text-sm text-foreground/55">No pricing set up yet for this layout.</p>
        <form action={firstBandAction} className="mt-3">
          <input type="hidden" name="layoutId" value={layoutId} />
          <button disabled={firstBandPending} className="rounded-full bg-course px-5 py-2 text-sm font-semibold text-course-contrast disabled:opacity-50">
            {firstBandPending ? "Adding…" : "Add pricing"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-2xl bg-white shadow-[0_18px_40px_-34px_rgba(16,50,34,0.4)] p-5">
      <h2 className="font-display text-lg font-semibold text-foreground">{layoutName}</h2>
      <p className="mt-1 text-sm text-foreground/55">Set a per-player green fee for each time band. Bands always cover the full day, so every hour has a price.</p>

      {moveState.message && !moveState.ok && <p className="mt-2 text-xs font-medium text-red-600">{moveState.message}</p>}

      {/* The real save form — invisible, holds no visible fields itself. Every
          price input below points at it via the form="" attribute, since it
          can't wrap the grid (the per-row split/merge/move controls are their
          own forms, and forms can't nest). */}
      <form id={formId} action={saveAction}>
        <input type="hidden" name="layoutId" value={layoutId} />
      </form>

      <div className="mt-4 overflow-x-auto">
        <div
          className="relative grid min-w-[560px]"
          style={{ gridTemplateColumns: "150px repeat(4, 1fr) 26px", gap: 0 }}
        >
          <div
            aria-hidden="true"
            className="rounded-lg border-[1.5px] bg-[#12a06f]/[0.07]"
            style={{ position: "absolute", gridColumn: "2 / 6", gridRow: `1 / ${bands.length + 2}`, inset: 0, ...accentBorderStyle }}
          />

          <div className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-foreground/45">Time</div>
          <div className="px-2 py-2 text-center text-xs font-semibold text-foreground/70">Mon–Thu</div>
          <div className="relative z-10 px-2 py-2 text-center text-xs font-semibold text-foreground/70">Fri</div>
          <div className="relative z-10 px-2 py-2 text-center text-xs font-semibold text-[#0f7d53]">Sat</div>
          <div className="relative z-10 px-2 py-2 text-center text-xs font-semibold text-[#0f7d53]">Sun</div>
          <div />

          {bands.map((band, i) => {
            const next = bands[i + 1];
            const isLast = i === bands.length - 1;
            const canSplit = band.endHour - band.startHour >= 2;
            const boundaryOptions = next
              ? Array.from({ length: next.endHour - band.startHour - 2 }, (_, k) => band.startHour + 1 + k)
              : [];

            return (
              <div key={band.id} className="contents">
                <div className="flex items-center gap-1.5 whitespace-nowrap px-2 py-2 text-sm text-foreground/80">
                  <span>{formatHour(band.startHour)}</span>
                  <span className="text-foreground/40">–</span>
                  {isLast ? (
                    <span>close</span>
                  ) : (
                    <form action={moveAction} className="inline">
                      <input type="hidden" name="beforeBandId" value={band.id} />
                      <input type="hidden" name="afterBandId" value={next.id} />
                      <select
                        key={band.endHour}
                        name="hour"
                        defaultValue={band.endHour}
                        disabled={structPending}
                        onChange={(e) => e.currentTarget.form?.requestSubmit()}
                        className="rounded border border-black/10 bg-white px-1.5 py-1 text-sm outline-none focus:border-[#12a06f]"
                      >
                        {boundaryOptions.map((h) => (
                          <option key={h} value={h}>{formatHour(h)}</option>
                        ))}
                      </select>
                    </form>
                  )}
                </div>

                <div className="px-1.5 py-1.5">
                  <input form={formId} name={`band_${band.id}_monThu`} inputMode="decimal" defaultValue={dollars(band.monThuFeeCents)} className={priceInp} />
                </div>
                <div className="relative z-10 px-1.5 py-1.5">
                  <input form={formId} name={`band_${band.id}_fri`} inputMode="decimal" defaultValue={dollars(band.friFeeCents)} className={priceInp} />
                </div>
                <div className="relative z-10 px-1.5 py-1.5">
                  <input form={formId} name={`band_${band.id}_sat`} inputMode="decimal" defaultValue={dollars(band.satFeeCents)} className={priceInpAccent} style={accentBorderStyle} />
                </div>
                <div className="relative z-10 px-1.5 py-1.5">
                  <input form={formId} name={`band_${band.id}_sun`} inputMode="decimal" defaultValue={dollars(band.sunFeeCents)} className={priceInpAccent} style={accentBorderStyle} />
                </div>

                <div className="flex items-center justify-center gap-1 px-1 py-1.5">
                  {canSplit && (
                    <form action={splitAction}>
                      <input type="hidden" name="bandId" value={band.id} />
                      <input type="hidden" name="hour" value={Math.round((band.startHour + band.endHour) / 2)} />
                      <button type="submit" disabled={structPending} title="Split this time band" className="text-foreground/40 hover:text-[#12a06f] text-sm leading-none disabled:opacity-40">+</button>
                    </form>
                  )}
                  {bands.length > 1 && (
                    <form action={mergeActionFn}>
                      <input type="hidden" name="bandId" value={band.id} />
                      <button type="submit" disabled={structPending} title="Remove this time band" className="text-foreground/40 hover:text-red-600 text-sm leading-none disabled:opacity-40">×</button>
                    </form>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6 space-y-4 border-t border-black/5 pt-5">
        <div className="flex items-center justify-between gap-4">
          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            <input form={formId} type="checkbox" name="cartAvailable" defaultChecked={pricing?.cartAvailable ?? true} className="h-4 w-4 accent-course" />
            Carts available
          </label>
          <label className="flex items-center gap-2">
            <span className="text-xs font-medium text-foreground/60">Cart fee per player</span>
            <div className="relative w-28">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40 text-sm">$</span>
              <input form={formId} name="cartFee" inputMode="decimal" defaultValue={dollars(pricing?.cartFee ?? 1500)} className={`${inp} pl-6`} />
            </div>
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <input form={formId} type="checkbox" name="nineHoleDiscount" defaultChecked={pricing?.nineHoleDiscount ?? true} className="h-4 w-4 accent-course" />
          9-hole rounds are half the green fee
        </label>

        <label className="block max-w-[200px]">
          <span className={lbl}>Member rate (no override set)</span>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40 text-sm">$</span>
            <input form={formId} name="memberFee" inputMode="decimal" defaultValue={dollars(pricing?.memberFee ?? 2500)} className={`${inp} pl-6`} />
          </div>
        </label>

        <div className="pt-1">
          <SaveButton label="Save pricing" pending={savePending} state={saveState} formId={formId} className="mt-0 rounded-full bg-course px-5 py-2 text-sm font-semibold text-course-contrast disabled:opacity-50" />
        </div>
      </div>
    </div>
  );
}
