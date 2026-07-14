"use client";

import { useActionState } from "react";
import { AuroraBackground } from "@/components/AuroraBackground";
import { submitRequest, type RequestState } from "./actions";

const init: RequestState = { ok: false, message: "" };
const inp = "w-full rounded-xl border border-black/10 bg-white/80 px-4 py-2.5 text-sm outline-none transition focus:border-linx-green focus:ring-2 focus:ring-linx-green/25";
const lbl = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-foreground/45";

export default function RequestPage() {
  const [state, action, pending] = useActionState(submitRequest, init);

  return (
    <main className="relative flex min-h-screen items-center justify-center px-5 py-12">
      <AuroraBackground />
      <div className="relative z-10 w-full max-w-lg animate-fade-up rounded-2xl p-7 shadow-[0_32px_84px_-34px_rgba(13,53,34,0.42)] lx-glass">
        <a href="/" className="text-xs font-medium text-foreground/50 hover:text-foreground/80">← LinxTimes</a>
        <h1 className="mt-3 font-display text-3xl font-semibold text-linx-green">Request access</h1>
        <p className="mt-1 text-sm text-foreground/60">Tell us about your course. We&apos;ll get you set up with a branded booking page.</p>

        {state.ok ? (
          <div className="mt-6 rounded-xl bg-green-50 p-5 text-center">
            <div className="text-3xl">⛳</div>
            <p className="mt-2 font-medium text-green-800">{state.message}</p>
          </div>
        ) : (
          <form action={action} className="mt-6 grid grid-cols-2 gap-3">
            <label className="col-span-2 block"><span className={lbl}>Your name *</span><input name="ownerName" required className={inp} /></label>
            <label className="col-span-2 block"><span className={lbl}>Course name *</span><input name="courseName" required className={inp} /></label>
            <label className="col-span-2 block"><span className={lbl}>Email *</span><input name="email" type="email" required className={inp} /></label>
            <label className="block"><span className={lbl}>City</span><input name="city" className={inp} /></label>
            <label className="block"><span className={lbl}>State</span><input name="state" className={inp} /></label>
            <label className="block"><span className={lbl}>Phone</span><input name="phone" className={inp} /></label>
            <label className="block"><span className={lbl}>Est. rounds / year</span><input name="estimatedRounds" inputMode="numeric" className={inp} /></label>
            <label className="col-span-2 block"><span className={lbl}>Anything else?</span><textarea name="message" rows={3} className={inp} /></label>

            {state.message && !state.ok && (
              <p className="col-span-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{state.message}</p>
            )}

            <button disabled={pending} className="col-span-2 mt-1 rounded-full bg-linx-green px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-50">
              {pending ? "Sending…" : "Request access"}
            </button>
          </form>
        )}
        <p className="mt-5 text-center text-xs text-foreground/45">
          Already approved? <a href="/onboard" className="font-medium text-linx-green underline-offset-2 hover:underline">Set up your course →</a>
        </p>
      </div>
    </main>
  );
}
