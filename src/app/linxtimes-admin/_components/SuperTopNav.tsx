"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { superLogout } from "../login/actions";

const NAV = [
  { href: "/linxtimes-admin", label: "Requests" },
  { href: "/linxtimes-admin/courses", label: "Courses" },
  { href: "/linxtimes-admin/stats", label: "Platform stats" },
];

export function SuperTopNav({ adminName }: { adminName: string }) {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-black/5 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center gap-5 px-6 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linx-gold font-display text-sm font-semibold text-linx-green">L</div>
          <span className="hidden text-sm font-semibold text-foreground sm:block">LinxTimes <span className="font-normal text-foreground/45">Admin</span></span>
        </div>

        <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
          {NAV.map((item) => {
            const active = item.href === "/linxtimes-admin" ? pathname === "/linxtimes-admin" : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-medium transition ${active ? "bg-linx-green text-white" : "text-foreground/60 hover:bg-black/[0.04]"}`}>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-foreground/45 sm:block">{adminName}</span>
          <form action={superLogout}>
            <button className="rounded-full border border-black/10 bg-white px-3.5 py-1.5 text-xs font-medium text-foreground/70 shadow-sm transition hover:bg-black/[0.03]">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
