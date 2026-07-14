"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "../login/actions";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: "M3 12l9-9 9 9M5 10v10h14V10" },
  { href: "/dashboard/bookings", label: "Bookings", icon: "M4 6h16M4 12h16M4 18h10" },
  { href: "/dashboard/members", label: "Members", icon: "M16 14a4 4 0 10-8 0M12 7a3 3 0 100-6 3 3 0 000 6" },
  { href: "/dashboard/tee-times", label: "Tee Times", icon: "M12 8v5l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { href: "/dashboard/pricing", label: "Pricing", icon: "M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" },
  { href: "/dashboard/settings", label: "Settings", icon: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a7.9 7.9 0 000-6l2-1.5-2-3.5-2.4 1a8 8 0 00-5-3L11.6 1H8.4L8 2.5a8 8 0 00-5 3l-2.4-1-2 3.5 2 1.5a7.9 7.9 0 000 6l-2 1.5 2 3.5 2.4-1a8 8 0 005 3L8.4 23h3.2l.4-1.5a8 8 0 005-3l2.4 1 2-3.5-2-1.5z" },
];

export function Sidebar({
  courseName,
  logoUrl,
}: {
  courseName: string;
  logoUrl: string | null;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 shrink-0 flex-col bg-linx-green text-white">
      <div className="flex items-center gap-3 px-5 py-5">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="h-9 w-9 rounded-lg bg-white/90 object-contain p-1" />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 font-display text-sm font-semibold">
            {courseName.slice(0, 1)}
          </div>
        )}
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{courseName}</div>
          <div className="text-[11px] text-white/50">LinxTimes dashboard</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {NAV.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                active ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={item.icon} />
              </svg>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <form action={logout} className="p-3">
        <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
          Sign out
        </button>
      </form>
    </aside>
  );
}
