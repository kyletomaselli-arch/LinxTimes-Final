"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { logout } from "../login/actions";

const ROLE_STYLES: Record<string, string> = {
  owner: "bg-[#eaf7ef] text-[#2f855a]",
  manager: "bg-[#e7f0fb] text-[#2b6cb0]",
  staff: "bg-black/[0.06] text-foreground/55",
};

/**
 * Who's signed in, in the expected corner: initials avatar, first name, role
 * chip, and a menu with Settings / Sign out. Replaces the empty gray circle.
 */
export function AccountMenu({ name, role }: { name: string; role: string }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
  const firstName = name.trim().split(/\s+/)[0] ?? name;

  return (
    <div ref={boxRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full bg-[#f2f4f7] py-1 pl-1 pr-3 transition hover:bg-black/[0.07]"
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-linx-green text-[10px] font-bold text-white">
          {initials || "?"}
        </span>
        <span className="hidden text-xs font-semibold text-foreground sm:block">{firstName}</span>
        <span className={`hidden rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize sm:block ${ROLE_STYLES[role] ?? ROLE_STYLES.staff}`}>
          {role}
        </span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-foreground/40" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-48 overflow-hidden rounded-xl border border-black/10 bg-white py-1.5 shadow-xl">
          <div className="px-3.5 pb-1.5 pt-1">
            <div className="truncate text-sm font-semibold text-foreground">{name}</div>
            <div className="text-[11px] capitalize text-foreground/45">{role}</div>
          </div>
          <div className="my-1 h-px bg-black/[0.05]" />
          <Link href="/dashboard/settings" onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-foreground/75 transition hover:bg-black/[0.04]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
            Settings
          </Link>
          <Link href="/dashboard/settings" onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-foreground/75 transition hover:bg-black/[0.04]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            Change password
          </Link>
          <div className="my-1 h-px bg-black/[0.05]" />
          <form action={logout}>
            <button className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-red-600 transition hover:bg-red-50">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
