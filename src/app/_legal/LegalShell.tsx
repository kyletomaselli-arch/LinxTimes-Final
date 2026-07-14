import Link from "next/link";
import { AuroraBackground } from "@/components/AuroraBackground";

/**
 * Shared shell for the Terms and Privacy pages. The body copy is DRAFT
 * placeholder text and MUST be replaced with attorney-reviewed language before
 * launch — see the banner.
 */
export function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main id="main-content" className="relative min-h-screen px-5 py-12">
      <AuroraBackground />
      <div className="relative z-10 mx-auto max-w-3xl rounded-2xl bg-white/80 p-7 shadow-[0_32px_84px_-34px_rgba(13,53,34,0.42)] backdrop-blur lx-glass">
        <Link href="/" className="text-sm font-medium text-linx-green underline-offset-2 hover:underline">
          ← Back to LinxTimes
        </Link>

        <div role="alert" className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Draft — pending legal review.</strong> This is placeholder text and is not legal
          advice. Replace with attorney-approved language before accepting live payments.
        </div>

        <h1 className="mt-6 font-display text-3xl font-semibold text-foreground">{title}</h1>
        <p className="mt-1 text-sm text-foreground/50">Last updated: {updated}</p>

        <div className="prose-legal mt-6 space-y-5 text-sm leading-relaxed text-foreground/75">
          {children}
        </div>
      </div>
    </main>
  );
}

export function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-lg font-semibold text-foreground">{heading}</h2>
      <div className="mt-1.5 space-y-2">{children}</div>
    </section>
  );
}
