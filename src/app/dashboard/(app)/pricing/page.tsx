import { requireCourseAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { updatePricing, updateBookingWindow, createMembershipTier, deleteMembershipTier } from "./actions";

const inp = "w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none transition focus:border-course focus:ring-2 focus:ring-course/25";

function dollars(cents: number | undefined): string {
  return cents != null ? (cents / 100).toFixed(2) : "";
}

export default async function PricingPage() {
  const { course } = await requireCourseAdmin();
  const [layouts, membershipTiers] = await Promise.all([
    prisma.layout.findMany({
      where: { courseId: course.id },
      include: { pricing: true },
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
        <form key={l.id} action={updatePricing} className="mt-6 rounded-2xl bg-white shadow-[0_18px_40px_-34px_rgba(16,50,34,0.4)] p-5">
          <input type="hidden" name="layoutId" value={l.id} />
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-foreground">{l.name} <span className="text-sm font-normal text-foreground/50">· {l.holes} holes</span></h2>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Money name="weekdayFee" label="Weekday green fee" v={dollars(l.pricing?.weekdayFee ?? 5000)} />
            <Money name="weekendFee" label="Weekend green fee" v={dollars(l.pricing?.weekendFee ?? 7000)} />
            <Money name="twilightFee" label="Twilight (flat)" v={dollars(l.pricing?.twilightFee ?? 3000)} />
            <div>
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-foreground/45">Twilight start hour (0–23)</span>
              <input name="twilightHour" type="number" min={0} max={23} defaultValue={l.pricing?.twilightHour ?? 16} className={inp} />
            </div>
            <Money name="memberFee" label="Member green fee" v={dollars(l.pricing?.memberFee ?? 2500)} />
            <Money name="cartFee" label="Cart fee" v={dollars(l.pricing?.cartFee ?? 1500)} />
          </div>
          <div className="mt-3 flex flex-wrap gap-5">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="cartAvailable" defaultChecked={l.pricing?.cartAvailable ?? true} className="h-4 w-4 accent-[var(--course-primary)]" /> Carts available</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="nineHoleDiscount" defaultChecked={l.pricing?.nineHoleDiscount ?? true} className="h-4 w-4 accent-[var(--course-primary)]" /> 9 holes = half green fee</label>
          </div>
          <button className="mt-4 rounded-full bg-course px-5 py-2 text-sm font-semibold text-course-contrast">Save {l.name} pricing</button>
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
