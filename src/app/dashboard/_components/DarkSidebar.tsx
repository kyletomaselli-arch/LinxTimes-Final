"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "../login/actions";

const ICON: Record<string, string> = {
  tee: "M3 4h18v18H3zM16 2v4M8 2v4M3 10h18",
  bookings: "M4 6h16M4 12h16M4 18h10",
  members: "M16 14a4 4 0 10-8 0M12 7a3 3 0 100-6 3 3 0 000 6",
  times: "M12 8v5l3 2 M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  pricing: "M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6",
  shop: "M6 7h12l-1 13H7zM9 7a3 3 0 016 0",
  discounts: "M4 4h7l9 9-7 7-9-9zM8 8h.01",
  reports: "M3 3v18h18M8 17v-6M13 17V7M18 17v-10",
  settings: "M12 9a3 3 0 100 6 3 3 0 000-6z M19.4 15a7.9 7.9 0 000-6l2-1.5-2-3.5-2.4 1a8 8 0 00-5-3L11.6 1H8.4L8 2.5a8 8 0 00-5 3l-2.4-1-2 3.5 2 1.5a7.9 7.9 0 000 6l-2 1.5 2 3.5 2.4-1a8 8 0 005 3L8.4 23h3.2l.4-1.5a8 8 0 005-3l2.4 1 2-3.5z",
};

const NAV = [
  { href: "/dashboard", label: "Tee Sheet", icon: "tee" },
  { href: "/dashboard/members", label: "Members", icon: "members" },
  { href: "/dashboard/pricing", label: "Pricing", icon: "pricing" },
  { href: "/dashboard/shop", label: "Shop", icon: "shop" },
  { href: "/dashboard/discounts", label: "Discounts", icon: "discounts" },
  { href: "/dashboard/reports", label: "Reports", icon: "reports" },
  { href: "/dashboard/tee-times", label: "Tee time settings", icon: "times" },
  { href: "/dashboard/bookings", label: "Bookings", icon: "bookings" },
];

export function DarkSidebar({ courseName, logoUrl }: { courseName: string; logoUrl: string | null }) {
  const pathname = usePathname();
  const isOn = (href: string) => (href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href));

  const item = (href: string, label: string, icon: string) => (
    <Link key={href} href={href} className={`flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium transition ${isOn(href) ? "bg-white/[0.12] text-white" : "text-white/55 hover:text-white hover:bg-white/[0.06]"}`}>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={ICON[icon]} /></svg>
      {label}
    </Link>
  );

  return (
    <aside className="sticky top-0 hidden h-screen w-[236px] shrink-0 flex-col bg-[#14181c] px-3.5 py-5 text-white md:flex">
      <div className="flex items-center gap-2.5 px-2 pb-5">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="h-8 w-8 rounded-lg bg-white object-contain p-0.5" />
        ) : (
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#12a06f] text-sm font-bold">{courseName.slice(0, 1)}</div>
        )}
        <b className="truncate text-[15px] font-semibold">{courseName}</b>
      </div>

      <div className="px-2.5 pb-2 pt-2 text-[10px] font-semibold tracking-[0.14em] text-white/35">COURSE</div>
      <nav className="space-y-0.5">{NAV.map((n) => item(n.href, n.label, n.icon))}</nav>

      <div className="px-2.5 pb-2 pt-5 text-[10px] font-semibold tracking-[0.14em] text-white/35">ACCOUNT</div>
      <nav className="space-y-0.5">{item("/dashboard/settings", "Settings", "settings")}</nav>

      <form action={logout} className="mt-auto pt-3">
        <button className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium text-white/55 transition hover:bg-white/[0.06] hover:text-white">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" /></svg>
          Sign out
        </button>
      </form>
    </aside>
  );
}
