import Link from "next/link";
import { AuroraBackground } from "@/components/AuroraBackground";
import { ResetForm } from "./ResetForm";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";

  return (
    <main className="relative flex min-h-screen items-center justify-center px-5 py-12">
      <AuroraBackground />
      <div className="relative z-10 w-full max-w-sm animate-fade-up rounded-2xl p-7 shadow-[0_32px_84px_-34px_rgba(13,53,34,0.42)] lx-glass">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-linx-green font-display text-lg font-semibold text-white">
            L
          </div>
          <h1 className="font-display text-2xl font-semibold text-linx-green">Set a new password</h1>
        </div>

        {token ? (
          <ResetForm token={token} />
        ) : (
          <div>
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              This reset link is missing or invalid. Please request a new one.
            </p>
            <p className="mt-6 text-center text-sm text-foreground/55">
              <Link href="/dashboard/forgot" className="font-medium text-linx-green hover:underline">
                Request a reset link
              </Link>
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
