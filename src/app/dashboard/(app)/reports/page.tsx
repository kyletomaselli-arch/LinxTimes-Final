import { requireCourseAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { todayKeyInTz, fromDateKey, toDateKey, addDays, timeToMinutes, dayOfWeek } from "@/lib/datetime";
import { MetricsChart } from "../../_components/MetricsChart";

const usd = (c: number) => (c / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

const PAID = new Set(["paid_online", "paid_in_person", "partially_paid"]);

export default async function ReportsPage(props: PageProps<"/dashboard/reports">) {
  const { course, admin } = await requireCourseAdmin();

  // Revenue is owner/manager only.
  if (admin.role === "staff") {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-3xl font-semibold text-foreground">Reports</h1>
        <p className="mt-3 rounded-2xl bg-white p-6 text-sm text-foreground/60 shadow-[0_18px_40px_-34px_rgba(16,50,34,0.4)]">
          Financial reports are available to owners and managers only.
        </p>
      </div>
    );
  }

  const today = todayKeyInTz(course.timezone);
  const monthStart = `${today.slice(0, 7)}-01`;
  const CHART_DAYS = 14;
  const chartStart = addDays(today, -(CHART_DAYS - 1));
  const sp = await props.searchParams;
  const get = (k: string, dflt: string) => {
    const v = sp[k];
    return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : dflt;
  };
  const from = get("from", monthStart);
  const to = get("to", today);

  const [bookings, chartBookings] = await Promise.all([
    prisma.booking.findMany({
      where: { courseId: course.id, bookingDate: { gte: fromDateKey(from), lte: fromDateKey(to) } },
      select: {
        paymentStatus: true, status: true, source: true, numPlayers: true,
        greenFeeCents: true, cartFeeCents: true, bookingFeeCents: true, taxCents: true,
        discountCents: true, creditCents: true, totalCents: true, amountPaidCents: true,
      },
    }),
    prisma.booking.findMany({
      where: { courseId: course.id, status: { not: "cancelled" }, bookingDate: { gte: fromDateKey(chartStart), lte: fromDateKey(today) } },
      select: { bookingDate: true, numPlayers: true, totalCents: true, paymentStatus: true },
    }),
  ]);
  // In-person LinxTimes fees ($/player) live on the Payment rows, by round date.
  const inPersonFeeAgg = await prisma.payment.aggregate({
    where: {
      courseId: course.id, state: "succeeded", method: "terminal",
      booking: { bookingDate: { gte: fromDateKey(from), lte: fromDateKey(to) } },
    },
    _sum: { feeCents: true },
  });

  let grossCollected = 0, courseRevenue = 0, tax = 0, linxFees = 0, refunds = 0;
  let discounts = 0, credits = 0, paidRounds = 0, players = 0, refundCount = 0, unpaid = 0;
  const bySource: Record<string, { rounds: number; collected: number }> = {};

  for (const b of bookings) {
    if (b.status === "cancelled" && b.paymentStatus !== "refunded") continue; // cancelled + unpaid: ignore
    if (b.paymentStatus === "refunded") {
      refunds += Math.max(0, b.totalCents - b.bookingFeeCents);
      linxFees += b.bookingFeeCents; // LinxTimes keeps its fee on a refund
      refundCount++;
      continue;
    }
    if (PAID.has(b.paymentStatus)) {
      const collected = b.paymentStatus === "paid_online" ? b.totalCents : b.amountPaidCents;
      grossCollected += collected;
      courseRevenue += b.greenFeeCents + b.cartFeeCents - b.discountCents - b.creditCents;
      tax += b.taxCents;
      linxFees += b.bookingFeeCents;
      discounts += b.discountCents;
      credits += b.creditCents;
      paidRounds++;
      players += b.numPlayers;
      const s = bySource[b.source] ?? { rounds: 0, collected: 0 };
      s.rounds++; s.collected += collected;
      bySource[b.source] = s;
    } else {
      unpaid++;
    }
  }
  linxFees += inPersonFeeAgg._sum.feeCents ?? 0;
  const netToCourse = courseRevenue + tax - refunds;

  // Chart series — rolling last 14 days
  const days = Array.from({ length: CHART_DAYS }, (_, i) => addDays(chartStart, i));
  const playersMap = new Map<string, number>();
  const bookingsMap = new Map<string, number>();
  const revenueMap = new Map<string, number>();
  const capacityMap = new Map<string, number>();

  // Need layout data to calculate capacity
  const layouts = await prisma.layout.findMany({
    where: { courseId: course.id, isActive: true },
    include: { teeTimeSlots: true },
  });

  const capacityForDay = (dayKey: string) => {
    const dayOfWk = dayOfWeek(dayKey);
    let cap = 0;
    for (const l of layouts) {
      const t = l.teeTimeSlots.find((s) => s.dayOfWeek === dayOfWk && s.isActive);
      if (t) {
        const slotCount = Math.ceil((timeToMinutes(t.endTime) - timeToMinutes(t.startTime)) / t.intervalMin) + 1;
        cap += slotCount * t.maxPlayers;
      }
    }
    return cap;
  };

  for (const b of chartBookings) {
    const k = toDateKey(b.bookingDate);
    playersMap.set(k, (playersMap.get(k) ?? 0) + b.numPlayers);
    bookingsMap.set(k, (bookingsMap.get(k) ?? 0) + 1);
    if (b.paymentStatus === "paid_online" || b.paymentStatus === "paid_in_person")
      revenueMap.set(k, (revenueMap.get(k) ?? 0) + b.totalCents);
  }

  const chartData = days.map((d) => ({
    date: d,
    label: new Date(d + "T00:00:00Z").toLocaleDateString("en-US", { month: "numeric", day: "numeric", timeZone: "UTC" }),
    players: playersMap.get(d) ?? 0,
    bookings: bookingsMap.get(d) ?? 0,
    fill: (() => { const c = capacityForDay(d); return c > 0 ? Math.round(((playersMap.get(d) ?? 0) / c) * 100) : 0; })(),
    revenueCents: revenueMap.get(d) ?? 0,
  }));

  const exportQs = new URLSearchParams({ from, to }).toString();
  const niceRange = `${from} → ${to}`;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-foreground">Financial report</h1>
          <p className="mt-1 text-sm text-foreground/50">By tee-time date · {niceRange}</p>
        </div>
        <a href={`/dashboard/bookings/export?${exportQs}`} className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-foreground/70 hover:bg-black/[0.04]">Export CSV</a>
      </div>

      {/* Date range */}
      <form className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl bg-white shadow-[0_18px_40px_-34px_rgba(16,50,34,0.4)] p-4">
        <label className="block"><span className={lbl}>From</span><input type="date" name="from" defaultValue={from} className={inp} /></label>
        <label className="block"><span className={lbl}>To</span><input type="date" name="to" defaultValue={to} className={inp} /></label>
        <button className="rounded-full bg-course px-5 py-2 text-sm font-semibold text-course-contrast">Apply</button>
        <a href="/dashboard/reports" className="rounded-full px-4 py-2 text-sm font-medium text-foreground/60 hover:bg-black/[0.04]">This month</a>
      </form>

      {/* Headline cards */}
      <div className="mt-5 grid grid-cols-2 gap-3.5 lg:grid-cols-3">
        <Card bg="#eaf7ef" label="Net to course" value={usd(netToCourse)} sub="green+cart+tax − refunds" />
        <Card bg="#eaf1fb" label="Gross collected" value={usd(grossCollected)} sub={`${paidRounds} paid rounds`} />
        <Card bg="#fdeee3" label="Sales tax collected" value={usd(tax)} sub="you remit this" />
      </div>

      {/* Chart — 14-day operational metrics */}
      <div className="mt-5 rounded-2xl bg-white p-4 pt-3.5 shadow-[0_18px_40px_-34px_rgba(16,50,34,0.4)]">
        <MetricsChart data={chartData} canSeeRevenue={true} />
      </div>

      {/* Detail table */}
      <div className="mt-5 overflow-hidden rounded-2xl bg-white shadow-[0_18px_40px_-34px_rgba(16,50,34,0.4)]">
        <table className="w-full text-sm">
          <tbody>
            <Line label="Course service revenue (green + cart, net of discounts)" value={usd(courseRevenue)} />
            <Line label="Sales tax collected (you remit)" value={usd(tax)} />
            <Line label="Refunds issued" value={`− ${usd(refunds)}`} negative />
            <Line label="Net to course (before Stripe processing fees)" value={usd(netToCourse)} strong />
            <Line label="Discounts given (course-funded)" value={usd(discounts)} muted />
            <Line label="Rain checks redeemed (course-funded)" value={usd(credits)} muted />
          </tbody>
        </table>
      </div>

      {/* Counts + by source */}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-[0_18px_40px_-34px_rgba(16,50,34,0.4)]">
          <b className="text-sm font-bold">Activity</b>
          <div className="mt-3 space-y-1.5 text-sm">
            <Row2 label="Paid rounds" value={String(paidRounds)} />
            <Row2 label="Players" value={String(players)} />
            <Row2 label="Refunds" value={String(refundCount)} />
            <Row2 label="Unpaid (confirmed, not yet collected)" value={String(unpaid)} />
          </div>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-[0_18px_40px_-34px_rgba(16,50,34,0.4)]">
          <b className="text-sm font-bold">By source</b>
          <div className="mt-3 space-y-1.5 text-sm">
            {Object.keys(bySource).length === 0 ? (
              <p className="text-foreground/40">No paid rounds in this range.</p>
            ) : (
              Object.entries(bySource).map(([src, v]) => (
                <Row2 key={src} label={`${src} · ${v.rounds} round${v.rounds === 1 ? "" : "s"}`} value={usd(v.collected)} />
              ))
            )}
          </div>
        </div>
      </div>

      <p className="mt-4 text-xs text-foreground/40">
        Figures are grouped by tee-time date. &quot;Net to course&quot; is what settles to your Stripe account before Stripe&apos;s
        card-processing fees (~2.9% + $0.30 online).
      </p>
    </div>
  );
}

const inp = "rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-course focus:ring-2 focus:ring-course/25";
const lbl = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-foreground/45";

function Card({ bg, label, value, sub }: { bg: string; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl p-[18px]" style={{ background: bg }}>
      <div className="text-xs font-medium text-[#6b7280]">{label}</div>
      <div className="mt-2 font-mono text-2xl font-bold text-[#1c2430]">{value}</div>
      {sub && <div className="mt-2 text-xs font-medium text-[#9aa1ab]">{sub}</div>}
    </div>
  );
}

function Line({ label, value, strong, muted, negative }: { label: string; value: string; strong?: boolean; muted?: boolean; negative?: boolean }) {
  return (
    <tr className="border-b border-black/[0.04] last:border-0">
      <td className={`px-5 py-3 ${muted ? "text-foreground/55" : "text-foreground/80"} ${strong ? "font-semibold text-foreground" : ""}`}>{label}</td>
      <td className={`px-5 py-3 text-right font-mono ${negative ? "text-red-600" : ""} ${strong ? "text-lg font-bold text-foreground" : "font-medium"}`}>{value}</td>
    </tr>
  );
}

function Row2({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="capitalize text-foreground/60">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
