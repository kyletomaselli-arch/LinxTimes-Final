"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "../login/actions";

const ICON: Record<string, string> = {
  tee: "M3 4h18v18H3zM16 2v4M8 2v4M3 10h18",
  bookings: "M4 6h16M4 12h16M4 18h10",
  members: "M16 14a4 4 0 10-8 0M12 7a3 3 0 100-6 3 3 0 000 6",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  times: "M12 8v5l3 2 M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  pricing: "M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6",
  shop: "M6 7h12l-1 13H7zM9 7a3 3 0 016 0",
  discounts: "M4 4h7l9 9-7 7-9-9zM8 8h.01",
  reports: "M3 3v18h18M8 17v-6M13 17V7M18 17v-10",
  settings: "M12 9a3 3 0 100 6 3 3 0 000-6z M19.4 15a7.9 7.9 0 000-6l2-1.5-2-3.5-2.4 1a8 8 0 00-5-3L11.6 1H8.4L8 2.5a8 8 0 00-5 3l-2.4-1-2 3.5 2 1.5a7.9 7.9 0 000 6l-2 1.5 2 3.5 2.4-1a8 8 0 005 3L8.4 23h3.2l.4-1.5a8 8 0 005-3l2.4 1 2-3.5z",
};

const TABS = [
  { href: "/dashboard", label: "Tee sheet", icon: "tee" },
  { href: "/dashboard/bookings", label: "Bookings", icon: "bookings" },
  { href: "/dashboard/members", label: "Members", icon: "members" },
];

const MORE = [
  { href: "/dashboard/pricing", label: "Pricing", icon: "pricing" },
  { href: "/dashboard/shop", label: "Shop", icon: "shop" },
  { href: "/dashboard/discounts", label: "Discounts", icon: "discounts" },
  { href: "/dashboard/reports", label: "Reports", icon: "reports" },
  { href: "/dashboard/tee-times", label: "Tee time settings", icon: "times" },
  { href: "/dashboard/settings", label: "Settings", icon: "settings" },
];

/**
 * Bottom tab bar for phones — the sidebar is hidden under md, so this is the
 * mobile navigation: the three everyday screens plus a "More" sheet with the
 * rest. Desktop is untouched.
 */
export function MobileTabBar() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const isOn = (href: string) => (href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href));
  const moreActive = MORE.some((m) => isOn(m.href));

  return (
    <>
      {moreOpen && (
        <div className="fixed inset-0 z-40 bg-black/45 md:hidden" onClick={() => setMoreOpen(false)}>
          <div
            className="absolute inset-x-0 bottom-[60px] rounded-t-2xl bg-white p-3 pb-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-black/15" />
            <div className="grid grid-cols-2 gap-1.5">
              {MORE.map((m) => (
                <Link
                  key={m.href}
                  href={m.href}
                  onClick={() => setMoreOpen(false)}
                  className={`flex items-center gap-2.5 rounded-xl px-3.5 py-3 text-sm font-medium transition ${
                    isOn(m.href) ? "bg-linx-green/10 text-linx-green" : "text-foreground/70 hover:bg-black/[0.04]"
                  }`}
                >
                  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICON[m.icon]} /></svg>
                  {m.label}
                </Link>
              ))}
            </div>
            <form action={logout} className="mt-2 border-t border-black/[0.06] pt-2">
              <button className="flex w-full items-center gap-2.5 rounded-xl px-3.5 py-3 text-sm font-medium text-red-600 transition hover:bg-red-50">
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" /></svg>
                Sign out
              </button>
            </form>
          </div>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-white/10 bg-[#14181c] pb-[env(safe-area-inset-bottom)] md:hidden">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            onClick={() => setMoreOpen(false)}
            className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-semibold transition ${
              isOn(t.href) && !moreOpen ? "text-[#12a06f]" : "text-white/50"
            }`}
          >
            <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICON[t.icon]} /></svg>
            {t.label}
          </Link>
        ))}
        <button
          onClick={() => setMoreOpen((o) => !o)}
          aria-expanded={moreOpen}
          className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-semibold transition ${
            moreOpen || moreActive ? "text-[#12a06f]" : "text-white/50"
          }`}
        >
          <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d={ICON.more} /></svg>
          More
        </button>
      </nav>
    </>
  );
}
