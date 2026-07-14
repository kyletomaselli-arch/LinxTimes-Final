"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelBookingAction } from "../actions";

/**
 * Cancel control for a booking row. Opens an inline confirm with an optional
 * reason and a 24-hour-override checkbox. If the server rejects for the 24-hour
 * window, it surfaces the message and lets the admin retry with override.
 */
export function CancelBookingButton({ bookingId }: { bookingId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [override, setOverride] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await cancelBookingAction(bookingId, reason, override);
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(res.message);
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-full border border-red-200 px-3 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50"
      >
        Cancel
      </button>
    );
  }

  return (
    <div className="w-64 rounded-xl border border-black/10 bg-white p-3 text-left shadow-lg">
      <p className="text-xs font-medium text-foreground/70">Cancel this booking?</p>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (optional)"
        className="mt-2 w-full rounded-lg border border-black/10 px-2.5 py-1.5 text-xs outline-none focus:border-course"
      />
      <label className="mt-2 flex items-center gap-2 text-xs text-foreground/70">
        <input
          type="checkbox"
          checked={override}
          onChange={(e) => setOverride(e.target.checked)}
          className="h-3.5 w-3.5 accent-red-600"
        />
        Override 24-hour rule
      </label>
      {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          onClick={submit}
          disabled={pending}
          className="flex-1 rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
        >
          {pending ? "Cancelling…" : "Confirm cancel"}
        </button>
        <button
          onClick={() => setOpen(false)}
          disabled={pending}
          className="rounded-full px-3 py-1.5 text-xs font-medium text-foreground/60 hover:bg-black/[0.04]"
        >
          Keep
        </button>
      </div>
    </div>
  );
}
