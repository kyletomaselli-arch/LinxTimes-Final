"use client";

import Link from "next/link";
import { useActionState } from "react";
import { resetPassword, type ResetState } from "../login/actions";

const initial: ResetState = { error: null, done: false };

export function ResetForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPassword, initial);

  if (state.done) {
    return (
      <div>
        <div className="rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          Your password has been updated. You can now sign in.
        </div>
        <Link
          href="/dashboard/login"
          className="mt-5 block w-full rounded-full bg-linx-green px-6 py-3 text-center text-sm font-semibold text-white shadow-md transition-all hover:-translate-y-0.5 hover:brightness-110"
        >
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
          New password
        </label>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="mt-2 w-full rounded-xl border border-black/10 bg-white/80 px-4 py-3 text-base outline-none transition focus:border-linx-green focus:ring-2 focus:ring-linx-green/25"
        />
        <p className="mt-1.5 text-xs text-foreground/45">At least 8 characters.</p>
      </div>
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
          Confirm password
        </label>
        <input
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
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
        {pending ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
