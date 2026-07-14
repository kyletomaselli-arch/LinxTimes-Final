"use client";

/** Small client helper: a Print button that invokes the browser print dialog. */
export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-full bg-[#0d3522] px-4 py-2 text-sm font-semibold text-white print:hidden"
    >
      Print
    </button>
  );
}
