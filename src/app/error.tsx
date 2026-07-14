"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="relative flex min-h-screen items-center justify-center px-5 py-12 text-center">
      <div className="lx-bg" aria-hidden="true">
        <div className="lx-aurora">
          <div className="lx-blob lx-blob-1" />
          <div className="lx-blob lx-blob-2" />
          <div className="lx-blob lx-blob-3" />
          <div className="lx-blob lx-blob-4" />
        </div>
        <div className="lx-wash" />
      </div>
      <div className="relative z-10 animate-fade-up">
        <div className="font-display text-4xl font-semibold text-linx-green">Something went wrong</div>
        <p className="mt-3 max-w-md text-sm text-foreground/55">
          An unexpected error occurred. You can try again — if it keeps happening, please let us know.
        </p>
        <button
          onClick={reset}
          className="mt-7 inline-block rounded-full bg-linx-green px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:brightness-110"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
