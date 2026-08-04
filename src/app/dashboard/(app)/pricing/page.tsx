import { requireCourseAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { updateBookingWindow, createMembershipTier, deleteMembershipTier, savePricingTier, deletePricingTier } from "./actions";
import { PricingFormClient } from "./PricingFormClient";

const inp = "w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none transition focus:border-course focus:ring-2 focus:ring-course/25";
const timeOpts = Array.from({ length: 24 }, (_, i) => ({ val: i, label: `${i === 0 ? 12 : i > 12 ? i - 12 : i}:00 ${i < 12 ? "AM" : "PM"}` }));

function dollars(cents: number | undefined): string {
  return cents != null ? (cents / 100).toFixed(2) : "";
}

export default async function PricingPage() {
  const { course } = await requireCourseAdmin();
  const [layouts, membershipTiers] = await Promise.all([
    prisma.layout.findMany({
      where: { courseId: course.id },
      include: {
        pricing: {
          include: { tiers: { orderBy: { sortOrder: "asc" } } }
        }
      },
      orderBy: { name: "asc" },
    }),
    prisma.membershipTier.findMany({
      where: { courseId: course.id },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-3xl font-semibold text-foreground">Pricing</h1>
      <p className="mt-1 text-sm text-foreground/55">Rates are per player. Twilight is a flat rate; 9 holes can be half the green fee.</p>

      {/* Booking window */}
      <form action={updateBookingWindow} className="mt-6 flex flex-wrap items-end gap-4 rounded-2xl bg-white shadow-[0_18px_40px_-34px_rgba(16,50,34,0.4)] p-5">
        <div>
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-foreground/45">Max days bookable ahead</span>
          <input name="maxDaysAhead" type="number" min={1} max={365} defaultValue={course.maxDaysAhead} className={`${inp} w-40`} />
        </div>
        <button className="rounded-full bg-course px-5 py-2 text-sm font-semibold text-course-contrast">Save window</button>
      </form>

      {layouts.map((l) => (
        <PricingFormClient key={l.id} layoutId={l.id} layoutName={l.name} pricing={l.pricing} />

          {/* Time-based pricing tiers */}
          <div className="mt-6 border-t border-black/5 pt-6">
            <h3 className="font-semibold text-foreground mb-1">Time-based pricing tiers</h3>
            <p className="text-xs text-foreground/60 mb-4">Set different rates for different times of day (e.g., early bird, peak, twilight)</p>

            {/* Add tier form */}
            <form action={savePricingTier} className="mb-4 flex flex-wrap items-end gap-3 rounded-lg bg-black/[0.02] p-4">
              <input type="hidden" name="layoutId" value={l.id} />
              <label className="block flex-1 min-w-48">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-foreground/45">Tier name</span>
                <input name="name" required placeholder="Early bird" className={inp} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-foreground/45">Start hour (0–23)</span>
                <select name="startHour" className={inp} defaultValue="6">
                  {timeOpts.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-foreground/45">End hour (0–23)</span>
                <select name="endHour" className={inp} defaultValue="10">
                  {timeOpts.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-foreground/45">Price ($)</span>
                <input name="fee" type="number" step="0.01" required placeholder="45.00" className={`${inp} w-24`} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-foreground/45">Apply to</span>
                <select name="applyTo" className={inp}>
                  <option value="both">Both days</option>
                  <option value="weekday">Weekdays</option>
                  <option value="weekend">Weekends</option>
                </select>
              </label>
              <button className="rounded-full bg-course px-5 py-2 text-sm font-semibold text-course-contrast">Add tier</button>
            </form>

            {/* List existing tiers */}
            {l.pricing?.tiers && l.pricing.tiers.length > 0 && (
              <div className="space-y-2">
                {l.pricing.tiers.map((tier) => (
                  <div key={tier.id} className="flex items-center justify-between rounded-lg bg-black/[0.02] px-4 py-3">
                    <div className="text-sm">
                      <span className="font-medium">{tier.name}</span>
                      <span className="ml-3 text-foreground/60">${(tier.feeCents / 100).toFixed(2)}</span>
                      <span className="ml-3 text-foreground/50 text-xs">
                        {timeOpts[tier.startHour]?.label ?? tier.startHour} – {timeOpts[tier.endHour]?.label ?? tier.endHour}
                      </span>
                      <span className="ml-3 text-foreground/50 text-xs">({tier.applyTo})</span>
                    </div>
                    <form action={deletePricingTier} className="flex items-center gap-2">
                      <input type="hidden" name="tierId" value={tier.id} />
                      <button type="submit" className="text-xs text-red-600 hover:text-red-700 font-medium">Delete</button>
                    </form>
                  </div>
                ))}
              </div>
            )}
          </div>
        </form>
      ))}

      {/* Membership tiers */}
      <div className="mt-6 rounded-2xl bg-white shadow-[0_18px_40px_-34px_rgba(16,50,34,0.4)] p-5">
        <h2 className="font-display text-lg font-semibold text-foreground">Membership tiers</h2>
        <p className="mt-1 text-sm text-foreground/55">Sell memberships at the counter. Staff will charge members when enrolling.</p>

        <form action={createMembershipTier} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="block flex-1 min-w-48"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-foreground/45">Tier name</span><input name="name" required placeholder="Annual Member" className={inp} /></label>
          <label className="block"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-foreground/45">Price ($)</span><input name="price" type="number" step="0.01" required placeholder="500.00" className={`${inp} w-32`} /></label>
          <button className="rounded-full bg-course px-5 py-2 text-sm font-semibold text-course-contrast">Add tier</button>
        </form>

        {membershipTiers.length > 0 && (
          <div className="mt-4 space-y-2">
            {membershipTiers.map((tier) => (
              <div key={tier.id} className="flex items-center justify-between rounded-lg bg-black/[0.02] px-3 py-2">
                <div className="text-sm">
                  <span className="font-medium">{tier.name}</span>
                  <span className="ml-2 text-foreground/60">${(tier.priceCents / 100).toFixed(2)}</span>
                </div>
                <form action={deleteMembershipTier} className="flex items-center gap-2">
                  <input type="hidden" name="tierId" value={tier.id} />
                  <button type="submit" className="text-xs text-red-600 hover:text-red-700 font-medium">Delete</button>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Money({ name, label, v }: { name: string; label: string; v: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-foreground/45">{label} ($)</span>
      <input name={name} inputMode="decimal" defaultValue={v} className={inp} />
    </label>
  );
}
