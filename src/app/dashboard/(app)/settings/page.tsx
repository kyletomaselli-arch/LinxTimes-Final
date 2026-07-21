import { requireCourseAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { buildConnectUrl } from "@/lib/stripe-connect";
import { ProfileForm, PasswordForm, ReaderForm } from "./SettingsForms";
import { TeamManager } from "./TeamManager";
import { refreshStripeStatus } from "./actions";
import { TakeOfflineButton } from "./_components/TakeOfflineButton";

async function refreshStripeStatusForm() {
  "use server";
  await refreshStripeStatus();
}

export default async function SettingsPage() {
  const { course, admin } = await requireCourseAdmin();
  const team = admin.role === "owner"
    ? await prisma.courseAdmin.findMany({ where: { courseId: course.id }, orderBy: { createdAt: "asc" } })
    : [];
  // buildConnectUrl reads Stripe Connect env vars and throws if any are
  // missing. Don't let that crash the whole Settings page — degrade to a
  // disabled "not configured" state so password/team/profile still work.
  let connectUrl: string | null = null;
  try {
    connectUrl = buildConnectUrl(course.id);
  } catch {
    connectUrl = null;
  }
  const connected = Boolean(course.stripeAccountId);
  const ready = course.stripeOnboarded;

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-3xl font-semibold text-foreground">Settings</h1>

      {/* Stripe connection */}
      <div className="mt-6 rounded-2xl bg-white shadow-[0_18px_40px_-34px_rgba(16,50,34,0.4)] p-5">
        <h2 className="font-display text-lg font-semibold text-foreground">Payments — Stripe</h2>
        <p className="mt-1 text-sm text-foreground/55">
          Connect your Stripe account to accept online payments. LinxTimes automatically takes its
          per-player fee and sends the rest to you.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
              ready ? "bg-green-100 text-green-800" : connected ? "bg-amber-100 text-amber-800" : "bg-black/[0.06] text-foreground/60"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${ready ? "bg-green-600" : connected ? "bg-amber-500" : "bg-foreground/40"}`} />
            {ready ? "Connected & ready" : connected ? "Connected — finishing setup" : "Not connected"}
          </span>
          {connectUrl ? (
            <a
              href={connectUrl}
              className="rounded-full bg-linx-green px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
            >
              {connected ? "Reconnect Stripe" : "Connect Stripe"}
            </a>
          ) : (
            <span
              className="rounded-full bg-black/[0.06] px-4 py-2 text-sm font-medium text-foreground/50"
              title="Stripe Connect isn't configured on the server yet (missing STRIPE_CLIENT_ID / APP_URL)."
            >
              Stripe not configured
            </span>
          )}
          {connected && !ready && (
            <form action={refreshStripeStatusForm}>
              <button className="rounded-full border border-black/10 px-4 py-2 text-sm font-medium text-foreground/70 hover:bg-black/[0.04]">
                Refresh status
              </button>
            </form>
          )}
        </div>
        {connected && !ready && (
          <p className="mt-2 text-xs text-amber-700/80">
            Your account is connected but Stripe is still verifying it. This can take a minute after
            you finish onboarding — click <span className="font-medium">Refresh status</span> once it&apos;s done.
          </p>
        )}

        {/* In-person card reader */}
        <div className="mt-5 border-t border-black/5 pt-4">
          <h3 className="text-sm font-semibold text-foreground">In-person card reader</h3>
          <p className="mt-1 text-sm text-foreground/55">
            {course.stripeTerminalReaderId
              ? "A reader is connected. Staff can charge walk-ins at the counter from the tee sheet."
              : "Connect a Stripe reader to charge walk-ins at the counter. On the reader, open Settings to see its registration code, then enter it here."}
          </p>
          <ReaderForm hasReader={Boolean(course.stripeTerminalReaderId)} />
        </div>
      </div>

      <div className="mt-6">
        <ProfileForm
          c={{
            name: course.name,
            address: course.address,
            city: course.city,
            state: course.state,
            zip: course.zip,
            phone: course.phone,
            website: course.website,
            logoUrl: course.logoUrl,
            heroImageUrl: course.heroImageUrl,
            primaryColor: course.primaryColor ?? "#0d3522",
            secondaryColor: course.secondaryColor ?? "#c9a84c",
            notificationEmail: course.notificationEmail,
            timezone: course.timezone,
            announcement: course.announcement,
          }}
        />
      </div>

      <PasswordForm />

      {admin.role === "owner" && (
        <div className="mt-6">
          <TeamManager members={team.map((t) => ({ id: t.id, name: t.name, email: t.email, role: t.role, isSelf: t.id === admin.id }))} />
        </div>
      )}

      {admin.role === "owner" && course.status === "active" && (
        <div className="mt-6 rounded-2xl bg-white shadow-[0_18px_40px_-34px_rgba(16,50,34,0.4)] p-5">
          <h2 className="font-display text-lg font-semibold text-foreground">Course status</h2>
          <p className="mt-1 text-sm text-foreground/55">Your course is currently live. Golfers can book tee times on your public page.</p>
          <p className="mt-3 text-sm text-foreground/70">
            <TakeOfflineButton />
          </p>
        </div>
      )}
    </div>
  );
}
