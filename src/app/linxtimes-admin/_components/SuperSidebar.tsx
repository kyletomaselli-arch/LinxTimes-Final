"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { superLogout } from "../login/actions";

const NAV = [
  { href: "/linxtimes-admin", label: "Requests", icon: "M4 6h16M4 12h16M4 18h10" },
  { href: "/linxtimes-admin/courses", label: "Courses", icon: "M3 21h18M5 21V7l7-4 7 4v14M9 9h2m-2 4h2m4-4h2m-2 4h2" },
  { href: "/linxtimes-admin/stats", label: "Platform stats", icon: "M4 19V5m4 14v-8m4 8V9m4 10V7m4 12V11" },
];

export function SuperSidebar({ adminName }: { adminName: string }) {
  const pathname = usePathname();
  return (
    <aside className="flex w-60 shrink-0 flex-col bg-linx-green text-white">
      <div className="px-5 py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-linx-gold font-display text-sm font-semibold text-linx-green">L</div>
          <div>
            <div className="text-sm font-semibold">LinxTimes</div>
            <div className="text-[11px] text-white/50">Super-admin</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-2">
        {NAV.map((item) => {
          const active = item.href === "/linxtimes-admin" ? pathname === "/linxtimes-admin" : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${active ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={item.icon} /></svg>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-5 py-2 text-[11px] text-white/40">{adminName}</div>
      <form action={superLogout} className="p-3">
        <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" /></svg>
          Sign out
        </button>
      </form>
    </aside>
  );
}
