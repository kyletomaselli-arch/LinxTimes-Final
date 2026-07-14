"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "../login/actions";

const NAV = [
  { href: "/dashboard", label: "Tee Sheet" },
  { href: "/dashboard/bookings", label: "Bookings" },
  { href: "/dashboard/members", label: "Members" },
  { href: "/dashboard/tee-times", label: "Tee Times" },
  { href: "/dashboard/pricing", label: "Pricing" },
  { href: "/dashboard/shop", label: "Shop" },
  { href: "/dashboard/discounts", label: "Discounts" },
  { href: "/dashboard/reports", label: "Reports" },
  { href: "/dashboard/settings", label: "Settings" },
];

export function TopNav({
  courseName,
  logoUrl,
  courseSlug,
}: {
  courseName: string;
  logoUrl: string | null;
  courseSlug: string;
}) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-black/5 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center gap-5 px-6 py-3">
        <div className="flex items-center gap-2.5">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-8 w-8 rounded-lg bg-white object-contain p-0.5 ring-1 ring-black/5" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linx-green font-display text-sm font-semibold text-white">
              {courseName.slice(0, 1)}
            </div>
          )}
          <span className="hidden text-sm font-semibold text-foreground sm:block">{courseName}</span>
        </div>

        <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
          {NAV.map((item) => {
            const active =
              item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-medium transition ${
                  active ? "bg-linx-green text-white" : "text-foreground/60 hover:bg-black/[0.04]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={`/${courseSlug}`}
            target="_blank"
            rel="noreferrer"
            className="hidden rounded-full px-3 py-1.5 text-xs font-medium text-foreground/60 transition hover:bg-black/[0.04] sm:block"
          >
            View page ↗
          </a>
          <form action={logout}>
            <button className="rounded-full border border-black/10 bg-white px-3.5 py-1.5 text-xs font-medium text-foreground/70 shadow-sm transition hover:bg-black/[0.03]">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
