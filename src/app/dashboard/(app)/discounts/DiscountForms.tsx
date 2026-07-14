"use client";

import { useActionState } from "react";
import { createPromo, issueRainCheck, type DiscountResult } from "./actions";

const inp = "rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none transition focus:border-course focus:ring-2 focus:ring-course/25";
const lbl = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-foreground/45";
const init: DiscountResult = { ok: false, message: "" };

export function CreatePromoForm() {
  const [state, action, pending] = useActionState(createPromo, init);
  return (
    <form action={action} className="mt-3 flex flex-wrap items-end gap-3">
      <label className="block"><span className={lbl}>Code</span><input name="code" placeholder="SPRING20" className={`${inp} w-36 uppercase`} /></label>
      <label className="block"><span className={lbl}>Type</span>
        <select name="kind" className={inp} defaultValue="percent">
          <option value="percent">% off</option>
          <option value="amount">$ off</option>
        </select>
      </label>
      <label className="block"><span className={lbl}>Amount</span><input name="value" inputMode="decimal" placeholder="20" className={`${inp} w-24`} /></label>
      <label className="block"><span className={lbl}>Expires (optional)</span><input name="expiresAt" type="date" className={inp} /></label>
      <label className="block"><span className={lbl}>Max uses (optional)</span><input name="maxRedemptions" inputMode="numeric" placeholder="∞" className={`${inp} w-24`} /></label>
      <button disabled={pending} className="rounded-full bg-course px-5 py-2 text-sm font-semibold text-course-contrast disabled:opacity-50">{pending ? "Adding…" : "Add code"}</button>
      {state.message && (
        <p className={`w-full text-sm font-medium ${state.ok ? "text-green-700" : "text-red-600"}`}>{state.message}</p>
      )}
    </form>
  );
}

export function RainCheckForm() {
  const [state, action, pending] = useActionState(issueRainCheck, init);
  return (
    <form action={action} className="mt-3 flex flex-wrap items-end gap-3">
      <label className="block"><span className={lbl}>Amount ($)</span><input name="amount" inputMode="decimal" placeholder="55.00" className={`${inp} w-28`} /></label>
      <label className="block"><span className={lbl}>Issued to (optional)</span><input name="note" placeholder="Golfer name" className={`${inp} w-44`} /></label>
      <label className="block flex-1"><span className={lbl}>Reason (optional)</span><input name="reason" placeholder="Rained out 7/12" className={`${inp} w-full`} /></label>
      <button disabled={pending} className="rounded-full bg-course px-5 py-2 text-sm font-semibold text-course-contrast disabled:opacity-50">{pending ? "Issuing…" : "Issue rain check"}</button>
      {state.message && (
        <p className={`w-full text-sm font-medium ${state.ok ? "text-green-700" : "text-red-600"}`}>{state.message}</p>
      )}
    </form>
  );
}
