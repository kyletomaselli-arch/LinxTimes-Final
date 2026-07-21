"use client";

import { useState } from "react";
import { takeOffline } from "../../../actions";

export function TakeOfflineButton() {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (!confirm("Are you sure? Golfers won't be able to book new tee times.")) return;
    setPending(true);
    try {
      const result = await takeOffline();
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
        className="text-xs font-medium text-red-700 hover:text-red-900 disabled:opacity-50"
      >
        {pending ? "Taking offline…" : "Take course offline"}
      </button>
      {message && <span className="text-xs font-medium text-green-700">{message}</span>}
    </div>
  );
}
