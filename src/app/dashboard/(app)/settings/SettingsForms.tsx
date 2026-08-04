"use client";

import { useState, useEffect } from "react";
import { useActionState } from "react";
import { updateProfile, changePassword, registerReader, type SettingsResult } from "./actions";
import { SaveButton } from "../../_components/SaveButton";
import { PreviewBookingPageModal } from "./_components/PreviewBookingPageModal";

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
  const [show, setShow] = useState(true);

  useEffect(() => {
    if (state.ok && state.message) {
      const timer = setTimeout(() => setShow(false), 2000);
      return () => clearTimeout(timer);
    }
    setShow(true);
  }, [state.message, state.ok]);

  if (!state.message || !show) return null;
  return (
    <p className={`mt-3 rounded-lg px-3 py-2 text-sm font-medium flex items-center gap-2 ${state.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
      {state.ok && <span>✓</span>}
      {state.message}
    </p>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-foreground/45">{label}</span>{children}</label>;
}

export function ProfileForm({ c }: { c: CourseValues }) {
  const [state, action, pending] = useActionState(updateProfile, init);
  const [heroImageFile, setHeroImageFile] = useState<File | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [heroPreview, setHeroPreview] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [formValues, setFormValues] = useState({
    name: c.name,
    logoUrl: c.logoUrl,
    heroImageUrl: c.heroImageUrl,
    primaryColor: c.primaryColor,
    announcement: c.announcement,
  });

  const handleFileSelect = (file: File | null, isHero: boolean) => {
    if (!file || !file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be smaller than 5 MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (isHero) {
        setHeroPreview(dataUrl);
        setFormValues((prev) => ({ ...prev, heroImageUrl: dataUrl }));
      } else {
        setLogoPreview(dataUrl);
        setFormValues((prev) => ({ ...prev, logoUrl: dataUrl }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (formData: FormData) => {
    // Don't send base64 images — they're too large for the database.
    // Preview only; only CDN URLs are saved.
    action(formData);
  };

  return (
    <>
      <PreviewBookingPageModal
        data={{
          courseName: formValues.name,
          logoUrl: formValues.logoUrl,
          heroImageUrl: formValues.heroImageUrl,
          primaryColor: formValues.primaryColor,
          announcement: formValues.announcement,
        }}
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
      />
      <form action={handleSubmit} className="rounded-2xl bg-white shadow-[0_18px_40px_-34px_rgba(16,50,34,0.4)] p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-semibold text-foreground">Course profile</h2>
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            className="text-sm font-medium text-foreground/60 hover:text-foreground transition rounded-full hover:bg-black/[0.04] px-3 py-1.5"
          >
            Preview booking page →
          </button>
        </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <F label="Course name"><input name="name" required value={formValues.name} onChange={(e) => setFormValues(prev => ({ ...prev, name: e.target.value }))} className={inp} /></F>
        <F label="Phone"><input name="phone" defaultValue={c.phone ?? ""} className={inp} /></F>
        <F label="Website"><input name="website" defaultValue={c.website ?? ""} className={inp} /></F>
        <F label="Address"><input name="address" defaultValue={c.address ?? ""} className={inp} /></F>
        <F label="City"><input name="city" defaultValue={c.city ?? ""} className={inp} /></F>
        <F label="State"><input name="state" defaultValue={c.state ?? ""} className={inp} /></F>
        <F label="ZIP"><input name="zip" defaultValue={c.zip ?? ""} className={inp} /></F>
        <F label="Timezone"><input name="timezone" defaultValue={c.timezone} className={inp} /></F>
        <F label="New-booking email"><input name="notificationEmail" type="email" defaultValue={c.notificationEmail ?? ""} className={inp} /></F>
      </div>

      {/* Logo upload */}
      <div className="mt-5 border-t border-black/[0.06] pt-5">
        <F label="Logo image">
          <div className="flex gap-3">
            <div className="flex-1">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null, false)}
                className="w-full text-sm"
              />
              <p className="mt-1 text-[11px] text-foreground/45">Uploads automatically and updates preview instantly</p>
            </div>
            {(logoPreview || c.logoUrl) && (
              <img src={logoPreview || c.logoUrl || undefined} alt="Logo" className="h-12 w-12 rounded-lg object-cover" />
            )}
          </div>
          <input
            name="logoUrl"
            type="url"
            placeholder="https://cdn.example.com/logo.png"
            value={formValues.logoUrl ?? ""}
            onChange={(e) => setFormValues(prev => ({ ...prev, logoUrl: e.target.value || null }))}
            className={`${inp} mt-2`}
          />
        </F>
      </div>

      {/* Hero image upload */}
      <div className="mt-5 border-t border-black/[0.06] pt-5">
        <F label="Hero image (booking page background)">
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null, true)}
                  className="w-full text-sm"
                />
                <p className="mt-1 text-[11px] text-foreground/45">Uploads automatically and updates preview instantly</p>
              </div>
              {(heroPreview || c.heroImageUrl) && (
                <img src={heroPreview || c.heroImageUrl || undefined} alt="Hero" className="h-20 w-32 rounded-lg object-cover" />
              )}
            </div>
            <input
              name="heroImageUrl"
              type="url"
              placeholder="https://cdn.example.com/hero.jpg"
              value={formValues.heroImageUrl ?? ""}
              onChange={(e) => setFormValues(prev => ({ ...prev, heroImageUrl: e.target.value || null }))}
              className={inp}
            />
          </div>
        </F>
      </div>
      <div className="mt-4">
        <F label="Booking page banner (optional)">
          <textarea name="announcement" rows={2} maxLength={280} value={formValues.announcement ?? ""} onChange={(e) => setFormValues(prev => ({ ...prev, announcement: e.target.value || null }))} placeholder="e.g. Frost delay until 9am · Greens aerated this week · Twilight rates after 4pm" className={`${inp} w-full resize-none`} />
        </F>
        <p className="mt-1 text-xs text-foreground/45">Shown at the top of your public booking page. Leave blank to hide.</p>
      </div>
      <div className="mt-4">
        <F label="Brand color"><input name="primaryColor" type="color" defaultValue={c.primaryColor} onChange={(e) => setFormValues(prev => ({ ...prev, primaryColor: e.target.value }))} className="h-10 w-16 rounded-lg border border-black/10" /><p className="mt-1 text-xs text-foreground/45">Used for buttons and accents on your booking page</p></F>
      </div>
      <Note state={state} />
      <SaveButton label="Save profile" pending={pending} state={state} />
    </form>
    </>
  );
}

export function ReaderForm({ hasReader }: { hasReader: boolean }) {
  const [state, action, pending] = useActionState(registerReader, init);
  return (
    <form action={action} className="mt-3">
      <div className="flex flex-wrap items-end gap-2">
        <F label="Registration code"><input name="code" placeholder="quick-brown-fox" className="rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-course" /></F>
        <F label="Label"><input name="label" placeholder="Pro shop reader" className="rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-course" /></F>
        <SaveButton label={hasReader ? "Replace reader" : "Connect reader"} pending={pending} state={state} className="rounded-full border border-black/10 px-4 py-2 text-sm font-medium text-foreground/70 hover:bg-black/[0.04] disabled:opacity-50" />
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
      <SaveButton label="Update password" pending={pending} state={state} />
    </form>
  );
}
