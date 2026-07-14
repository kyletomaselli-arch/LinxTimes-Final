"use client";

import { useActionState } from "react";
import { createShopItem, type ShopResult } from "./actions";

const inp = "rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none transition focus:border-course focus:ring-2 focus:ring-course/25";
const lbl = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-foreground/45";
const init: ShopResult = { ok: false, message: "" };

export function ShopForm() {
  const [state, action, pending] = useActionState(createShopItem, init);
  return (
    <form action={action} className="mt-3 flex flex-wrap items-end gap-3">
      <label className="block"><span className={lbl}>Item</span><input name="name" placeholder="Club rental" className={`${inp} w-56`} /></label>
      <label className="block"><span className={lbl}>Price ($)</span><input name="price" inputMode="decimal" placeholder="25.00" className={`${inp} w-28`} /></label>
      <button disabled={pending} className="rounded-full bg-course px-5 py-2 text-sm font-semibold text-course-contrast disabled:opacity-50">{pending ? "Adding…" : "Add item"}</button>
      {state.message && (
        <p className={`w-full text-sm font-medium ${state.ok ? "text-green-700" : "text-red-600"}`}>{state.message}</p>
      )}
    </form>
  );
}
