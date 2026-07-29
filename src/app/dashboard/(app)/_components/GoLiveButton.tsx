"use client";

import { useState } from "react";
import { goLive } from "../../actions";

export function GoLiveButton() {
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    try {
      const res = await goLive();
      setResult(res);
      // Keep an error message up longer (it lists what's missing); clear a
      // success toast quickly since the page will reload live.
      setTimeout(() => setResult(null), res.ok ? 3000 : 8000);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleClick}
        disabled={pending || !!result?.ok}
        className="rounded-full bg-linx-green px-4 py-1.5 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
      >
        {pending ? "Going live…" : "Go live"}
      </button>
      {result && (
        <span className={`text-xs font-medium ${result.ok ? "text-green-700" : "text-amber-800"}`}>
          {result.message}
        </span>
      )}
    </div>
  );
}
