"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AuroraBackground } from "@/components/AuroraBackground";
import { requestPasswordReset, type ResetRequestState } from "../login/actions";

const initial: ResetRequestState = { message: null, error: null };

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, initial);

  return (
    <main className="relative flex min-h-screen items-center justify-center px-5 py-12">
      <AuroraBackground />
      <div className="relative z-10 w-full max-w-sm animate-fade-up rounded-2xl p-7 shadow-[0_32px_84px_-34px_rgba(13,53,34,0.42)] lx-glass">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-linx-green font-display text-lg font-semibold text-white">
            L
          </div>
          <h1 className="font-display text-2xl font-semibold text-linx-green">Reset password</h1>
          <p className="mt-1 text-sm text-foreground/60">
            Enter your email and we&apos;ll send a reset link.
          </p>
        </div>

        {state.message ? (
          <div className="rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
            {state.message}
          </div>
        ) : (
          <form action={formAction} className="space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
                Email
              </label>
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                className="mt-2 w-full rounded-xl border border-black/10 bg-white/80 px-4 py-3 text-base outline-none transition focus:border-linx-green focus:ring-2 focus:ring-linx-green/25"
              />
            </div>

            {state.error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                {state.error}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-full bg-linx-green px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:-translate-y-0.5 hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-foreground/55">
          <Link href="/dashboard/login" className="font-medium text-linx-green hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
