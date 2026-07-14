"use client";

import { useActionState } from "react";
import { updateProfile, changePassword, registerReader, type SettingsResult } from "./actions";

const inp = "w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none transition focus:border-course focus:ring-2 focus:ring-course/25";
const init: SettingsResult = { ok: false, message: "" };

export interface CourseValues {
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  website: string | null;
  logoUrl: string | null;
  heroImageUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  notificationEmail: string | null;
  timezone: string;
  announcement: string | null;
}

function Note({ state }: { state: SettingsResult }) {
  if (!state.message) return null;
  return (
    <p className={`mt-3 rounded-lg px-3 py-2 text-sm font-medium ${state.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
      {state.message}
    </p>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-foreground/45">{label}</span>{children}</label>;
}

export function ProfileForm({ c }: { c: CourseValues }) {
  const [state, action, pending] = useActionState(updateProfile, init);
  return (
    <form action={action} className="rounded-2xl bg-white shadow-[0_18px_40px_-34px_rgba(16,50,34,0.4)] p-5">
      <h2 className="font-display text-lg font-semibold text-foreground">Course profile</h2>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <F label="Course name"><input name="name" required defaultValue={c.name} className={inp} /></F>
        <F label="Phone"><input name="phone" defaultValue={c.phone ?? ""} className={inp} /></F>
        <F label="Website"><input name="website" defaultValue={c.website ?? ""} className={inp} /></F>
        <F label="Address"><input name="address" defaultValue={c.address ?? ""} className={inp} /></F>
        <F label="City"><input name="city" defaultValue={c.city ?? ""} className={inp} /></F>
        <F label="State"><input name="state" defaultValue={c.state ?? ""} className={inp} /></F>
        <F label="ZIP"><input name="zip" defaultValue={c.zip ?? ""} className={inp} /></F>
        <F label="Timezone"><input name="timezone" defaultValue={c.timezone} className={inp} /></F>
        <F label="New-booking email"><input name="notificationEmail" type="email" defaultValue={c.notificationEmail ?? ""} className={inp} /></F>
        <F label="Logo URL"><input name="logoUrl" defaultValue={c.logoUrl ?? ""} className={inp} /></F>
        <F label="Hero image URL"><input name="heroImageUrl" defaultValue={c.heroImageUrl ?? ""} className={inp} /></F>
      </div>
      <div className="mt-4">
        <F label="Booking-page announcement (optional)">
          <textarea name="announcement" rows={2} maxLength={280} defaultValue={c.announcement ?? ""} placeholder="e.g. Frost delay until 9am · Greens aerated this week · Twilight rates after 4pm" className={`${inp} w-full resize-none`} />
        </F>
        <p className="mt-1 text-xs text-foreground/45">Shown as a banner on your public booking page. Leave blank to hide.</p>
      </div>
      <div className="mt-4 flex gap-5">
        <F label="Primary color"><input name="primaryColor" type="color" defaultValue={c.primaryColor} className="h-10 w-16 rounded-lg border border-black/10" /></F>
        <F label="Secondary color"><input name="secondaryColor" type="color" defaultValue={c.secondaryColor} className="h-10 w-16 rounded-lg border border-black/10" /></F>
      </div>
      <Note state={state} />
      <button disabled={pending} className="mt-4 rounded-full bg-course px-5 py-2 text-sm font-semibold text-course-contrast disabled:opacity-50">{pending ? "Saving…" : "Save profile"}</button>
    </form>
  );
}

export function ReaderForm({ hasReader }: { hasReader: boolean }) {
  const [state, action, pending] = useActionState(registerReader, init);
  return (
    <form action={action} className="mt-3">
      <div className="flex flex-wrap items-end gap-2">
        <F label="Registration code"><input name="code" placeholder="quick-brown-fox" className="rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-course" /></F>
        <F label="Label"><input name="label" placeholder="Pro shop reader" className="rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-course" /></F>
        <button disabled={pending} className="rounded-full border border-black/10 px-4 py-2 text-sm font-medium text-foreground/70 hover:bg-black/[0.04] disabled:opacity-50">
          {pending ? "Connecting…" : hasReader ? "Replace reader" : "Connect reader"}
        </button>
      </div>
      <Note state={state} />
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, init);
  return (
    <form action={action} className="mt-6 rounded-2xl bg-white shadow-[0_18px_40px_-34px_rgba(16,50,34,0.4)] p-5">
      <h2 className="font-display text-lg font-semibold text-foreground">Change password</h2>
      <div className="mt-4 grid max-w-md gap-3">
        <F label="Current password"><input name="current" type="password" autoComplete="current-password" required className={inp} /></F>
        <F label="New password"><input name="next" type="password" autoComplete="new-password" required className={inp} /></F>
      </div>
      <Note state={state} />
      <button disabled={pending} className="mt-4 rounded-full bg-course px-5 py-2 text-sm font-semibold text-course-contrast disabled:opacity-50">{pending ? "Updating…" : "Update password"}</button>
    </form>
  );
}
