"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { searchDashboard, type DashboardSearchResult } from "../actions";
import { formatTimeLabel } from "@/lib/datetime";

const EMPTY: DashboardSearchResult = { bookings: [], members: [] };

/** Payment pill colors matching the tee sheet / badges convention. */
function payPill(status: string): { label: string; cls: string } {
  if (status === "paid_online") return { label: "Paid", cls: "bg-[#eaf7ef] text-[#2f855a]" };
  if (status === "paid_in_person") return { label: "Paid · counter", cls: "bg-[#eaf7ef] text-[#2f855a]" };
  if (status === "partially_paid") return { label: "Part-paid", cls: "bg-[#e7f0fb] text-[#2b6cb0]" };
  if (status === "refunded") return { label: "Refunded", cls: "bg-black/[0.06] text-foreground/50" };
  return { label: "Unpaid", cls: "bg-[#fef3e2] text-[#b7791f]" };
}

/**
 * Live search over bookings (name / email / confirmation #) and members.
 * Replaces the decorative div that used to sit in the top bar. ⌘K / Ctrl+K
 * focuses it from anywhere in the dashboard.
 */
export function DashboardSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<DashboardSearchResult>(EMPTY);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // ⌘K / Ctrl+K focuses the search from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Close when clicking outside.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Debounced search.
  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setResults(EMPTY);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      searchDashboard(query)
        .then((r) => setResults(r))
        .catch(() => setResults(EMPTY))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const hasResults = results.bookings.length > 0 || results.members.length > 0;

  const goBooking = (dateKey: string) => {
    setOpen(false);
    setQ("");
    router.push(`/dashboard?date=${dateKey}`);
  };
  const goMembers = () => {
    setOpen(false);
    setQ("");
    router.push("/dashboard/members");
  };

  return (
    <div ref={boxRef} className="relative w-full max-w-sm">
      <div className="flex items-center gap-2 rounded-[10px] bg-[#f2f4f7] px-4 py-2 transition focus-within:bg-white focus-within:ring-2 focus-within:ring-[#12a06f]/40">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-foreground/40" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search bookings, members…"
          className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-foreground/40"
        />
        <kbd className="hidden shrink-0 rounded bg-black/[0.06] px-1.5 py-0.5 text-[10px] font-semibold text-foreground/45 sm:block">⌘K</kbd>
      </div>

      {open && q.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-black/10 bg-white shadow-xl">
          {!hasResults && (
            <div className="px-4 py-5 text-center text-xs text-foreground/45">
              {searching ? "Searching…" : "No bookings or members match."}
            </div>
          )}
          {results.bookings.length > 0 && (
            <div className="p-1.5">
              <div className="px-2.5 pb-1 pt-1.5 text-[10px] font-bold tracking-wide text-foreground/40">BOOKINGS</div>
              {results.bookings.map((b) => {
                const pill = payPill(b.paymentStatus);
                return (
                  <button
                    key={b.id}
                    onClick={() => goBooking(b.dateKey)}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition hover:bg-black/[0.04]"
                  >
                    <span className="min-w-0 truncate">
                      <b>{b.golferName}</b>
                      <span className="text-foreground/50"> · {b.dateKey} {formatTimeLabel(b.slotTime)} · {b.numPlayers}p</span>
                    </span>
                    {b.status === "cancelled" ? (
                      <span className="ml-auto shrink-0 rounded-full bg-black/[0.06] px-2 py-0.5 text-[10px] font-semibold text-foreground/50">Cancelled</span>
                    ) : (
                      <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${pill.cls}`}>{pill.label}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          {results.members.length > 0 && (
            <div className="border-t border-black/[0.05] p-1.5">
              <div className="px-2.5 pb-1 pt-1.5 text-[10px] font-bold tracking-wide text-foreground/40">MEMBERS</div>
              {results.members.map((m) => (
                <button
                  key={m.id}
                  onClick={goMembers}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition hover:bg-black/[0.04]"
                >
                  <b>{m.name}</b>
                  <span className="text-foreground/50">· member {m.memberId}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
