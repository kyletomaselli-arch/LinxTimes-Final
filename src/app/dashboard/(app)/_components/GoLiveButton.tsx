"use client";

import { useState } from "react";
import { goLive } from "../../actions";

export function GoLiveButton() {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    try {
      const result = await goLive();
      setMessage(result.message);
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleClick}
        disabled={pending || !!message}
        className="rounded-full bg-linx-green px-4 py-1.5 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
      >
        {pending ? "Going live…" : "Go live"}
      </button>
      {message && <span className="text-xs font-medium text-green-700">{message}</span>}
    </div>
  );
}
