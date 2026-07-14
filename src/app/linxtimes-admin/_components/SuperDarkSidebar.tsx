"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { superLogout } from "../login/actions";

const NAV = [
  { href: "/linxtimes-admin", label: "Requests", icon: "M4 6h16M4 12h16M4 18h10" },
  { href: "/linxtimes-admin/courses", label: "Courses", icon: "M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M9 13h.01M9 17h.01M15 9h.01M15 13h.01M15 17h.01" },
  { href: "/linxtimes-admin/stats", label: "Platform stats", icon: "M4 19V5M4 19h16M8 19v-6M12 19V9M16 19v-3" },
];

export function SuperDarkSidebar({ adminName }: { adminName: string }) {
  const pathname = usePathname();
  const isOn = (href: string) => (href === "/linxtimes-admin" ? pathname === "/linxtimes-admin" : pathname.startsWith(href));

  return (
    <aside className="sticky top-0 flex h-screen w-[236px] shrink-0 flex-col bg-[#14181c] px-3.5 py-5 text-white">
      <div className="flex items-center gap-2.5 px-2 pb-5">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-linx-gold text-sm font-bold text-linx-green">L</div>
        <b className="text-[15px] font-semibold">LinxTimes <span className="font-normal text-white/45">Admin</span></b>
      </div>
      <div className="px-2.5 pb-2 pt-2 text-[10px] font-semibold tracking-[0.14em] text-white/35">PLATFORM</div>
      <nav className="space-y-0.5">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={`flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium transition ${isOn(n.href) ? "bg-white/[0.12] text-white" : "text-white/55 hover:bg-white/[0.06] hover:text-white"}`}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={n.icon} /></svg>
            {n.label}
          </Link>
        ))}
      </nav>
      <form action={superLogout} className="mt-auto pt-3">
        <button className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium text-white/55 transition hover:bg-white/[0.06] hover:text-white">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" /></svg>
          Sign out
        </button>
      </form>
    </aside>
  );
}
