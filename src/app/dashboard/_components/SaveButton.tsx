"use client";

import { useState, useEffect } from "react";

export function SaveButton({
  label,
  pending,
  state,
  className = "mt-4 rounded-full bg-course px-5 py-2 text-sm font-semibold text-course-contrast disabled:opacity-50"
}: {
  label: string;
  pending: boolean;
  state: { ok: boolean; message?: string };
  className?: string;
}) {
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (state.ok && state.message) {
      setShowSaved(true);
      const timer = setTimeout(() => setShowSaved(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [state.ok, state.message]);

  return (
    <div className="flex items-center gap-2">
      <button
        disabled={pending}
        className={className}
      >
        {pending ? `${label.replace(/^Save |^Update /, "")}…` : label}
      </button>
      {showSaved && (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 animate-fade-out">
          <i className="ti ti-check" aria-hidden="true" /> Saved
        </span>
      )}
    </div>
  );
}
