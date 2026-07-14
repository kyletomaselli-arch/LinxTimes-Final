"use client";

import { useEffect, useState, useTransition } from "react";
import { lookupOnboarding, finishOnboarding } from "./actions";

const inp = "w-full rounded-xl border border-black/10 bg-white/80 px-4 py-2.5 text-sm outline-none transition focus:border-linx-green focus:ring-2 focus:ring-linx-green/25";
const lbl = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-foreground/45";

export function OnboardWizard({ token }: { token: string }) {
  const [step, setStep] = useState<"identify" | "setup">("identify");
  const [email, setEmail] = useState("");
  const [courseName, setCourseName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // With a token link, resolve eligibility immediately (no email needed).
  useEffect(() => {
    if (!token) return;
    startTransition(async () => {
      const res = await lookupOnboarding("", token);
      if (res.ok) {
        setCourseName(res.courseName ?? "");
        setEmail(res.email ?? "");
        setStep("setup");
      } else {
        setError(res.message ?? "This link is invalid or expired.");
      }
    });
  }, [token]);

  function identify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const value = new FormData(e.currentTarget).get("email") as string;
    startTransition(async () => {
      const res = await lookupOnboarding(value, "");
      if (res.ok) {
        setEmail(res.email ?? value);
        setCourseName(res.courseName ?? "");
        setStep("setup");
      } else {
        setError(res.message ?? "Not found.");
      }
    });
  }

  function finish(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await finishOnboarding(fd); // redirects on success
      if (res && !res.ok) setError(res.message ?? "Could not complete setup.");
    });
  }

  const steps = ["Verify", "Set password", "Set up in dashboard"];
  const activeIdx = step === "identify" ? 0 : 1;

  return (
    <>
      <div className="mb-6 flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <span className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${i === activeIdx ? "bg-linx-green text-white" : i < activeIdx ? "bg-linx-green/15 text-linx-green" : "bg-black/[0.05] text-foreground/40"}`}>
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/25 text-[10px]">{i < activeIdx ? "✓" : i + 1}</span>
              <span className="hidden sm:inline">{s}</span>
            </span>
            {i < steps.length - 1 && <span className="h-px w-4 bg-black/10" />}
          </div>
        ))}
      </div>

      {step === "identify" && (
        <form onSubmit={identify}>
          <p className="mb-4 text-sm text-foreground/60">Enter the email your course was approved with.</p>
          <label className="block"><span className={lbl}>Email</span><input name="email" type="email" required defaultValue={email} className={inp} /></label>
          {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
          <button disabled={pending} className="mt-5 w-full rounded-full bg-linx-green px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-50">{pending ? "Checking…" : "Continue"}</button>
        </form>
      )}

      {step === "setup" && (
        <form onSubmit={finish}>
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="token" value={token} />
          <p className="mb-4 text-sm text-foreground/60">Setting up <span className="font-semibold text-linx-green">{courseName}</span>. Create your admin login.</p>
          <label className="block"><span className={lbl}>Your name</span><input name="adminName" required className={inp} /></label>
          <label className="mt-3 block"><span className={lbl}>Password (min 8 chars)</span><input name="password" type="password" autoComplete="new-password" required className={inp} /></label>
          {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
          <button disabled={pending} className="mt-5 w-full rounded-full bg-linx-green px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-50">{pending ? "Creating…" : "Create account & continue"}</button>
          <p className="mt-3 text-center text-xs text-foreground/45">You&apos;ll finish course details, pricing, and Stripe in your dashboard.</p>
        </form>
      )}
    </>
  );
}
