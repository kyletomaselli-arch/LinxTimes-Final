import { AuroraBackground } from "@/components/AuroraBackground";
import { OnboardWizard } from "./OnboardWizard";

export default async function OnboardPage(props: PageProps<"/onboard">) {
  const sp = await props.searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";

  return (
    <main className="relative flex min-h-screen items-center justify-center px-5 py-12">
      <AuroraBackground />
      <div className="relative z-10 w-full max-w-md animate-fade-up rounded-2xl p-7 shadow-[0_32px_84px_-34px_rgba(13,53,34,0.42)] lx-glass">
        <a href="/" className="text-xs font-medium text-foreground/50 hover:text-foreground/80">← LinxTimes</a>
        <h1 className="mt-3 font-display text-2xl font-semibold text-linx-green">Set up your course</h1>
        <p className="mt-1 mb-6 text-sm text-foreground/60">Welcome aboard. Let&apos;s get your booking page live.</p>
        <OnboardWizard token={token} />
      </div>
    </main>
  );
}
