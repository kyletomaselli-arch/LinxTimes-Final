import Link from "next/link";
import { AuroraBackground } from "@/components/AuroraBackground";

export default function NotFound() {
  return (
    <main className="relative flex min-h-screen items-center justify-center px-5 py-12 text-center">
      <AuroraBackground />
      <div className="relative z-10 animate-fade-up">
        <div className="font-display text-7xl font-semibold text-linx-green">404</div>
        <p className="mt-3 text-lg font-medium text-foreground/70">We couldn&apos;t find that page.</p>
        <p className="mt-1 text-sm text-foreground/50">
          The course may not exist yet, or the link is out of date.
        </p>
        <Link
          href="/"
          className="mt-7 inline-block rounded-full bg-linx-green px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:brightness-110"
        >
          Back to LinxTimes
        </Link>
      </div>
    </main>
  );
}
