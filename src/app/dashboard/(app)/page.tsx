import Link from "next/link";
import { requireCourseAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  todayKeyInTz, fromDateKey, toDateKey, addDays, dayOfWeek,
  timeToMinutes, minutesToTime,
} from "@/lib/datetime";
import { hoursUntilTeeTime, refundableCents, CANCELLATION_WINDOW_HOURS } from "@/lib/cancellation";
import { sweepAbandonedBookings } from "@/lib/booking-sweep";
import { TeeSheetClient, type Slot } from "../_components/TeeSheetClient";
import type { Booking } from "@/generated/prisma";

function slotTimes(s: string, e: string, i: number): string[] {
  const out: string[] = [];
  const end = timeToMinutes(e);
  for (let m = timeToMinutes(s); m <= end; m += i) out.push(minutesToTime(m));
  return out;
}
function labelParts(hhmm: string): { label: string; ampm: "AM" | "PM" } {
  const [h, m] = hhmm.split(":").map(Number);
  return { label: `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")}`, ampm: h < 12 ? "AM" : "PM" };
}

export default async function TeeSheetPage(props: PageProps<"/dashboard">) {
  const { course, admin } = await requireCourseAdmin();
  const sp = await props.searchParams;
  const today = todayKeyInTz(course.timezone);
  const selected = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const selDate = fromDateKey(selected);

  const layouts = await prisma.layout.findMany({
    where: { courseId: course.id, isActive: true },
    include: { teeTimeSlots: true },
    orderBy: { name: "asc" },
  });

  const shopItems = await prisma.shopItem.findMany({
    where: { courseId: course.id, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, priceCents: true },
  });

  // The tee sheet counts capacity directly, so release abandoned online
  // checkouts here too (the public grid does this inside computeAvailability).
  await sweepAbandonedBookings(course.id);

  // Week strip window: two days back, four ahead of the selected day.
  const stripStart = addDays(selected, -2);
  const stripDays = Array.from({ length: 7 }, (_, i) => addDays(stripStart, i));

  const [dayBookings, overrides, upcomingWeek, prevWeek, stripBooked] = await Promise.all([
    prisma.booking.findMany({ where: { courseId: course.id, bookingDate: selDate, status: { not: "cancelled" } } }),
    prisma.dailyOverride.findMany({ where: { courseId: course.id, overrideDate: selDate } }),
    prisma.booking.count({ where: { courseId: course.id, status: { not: "cancelled" }, bookingDate: { gt: fromDateKey(today), lte: fromDateKey(addDays(today, 7)) } } }),
    prisma.booking.findMany({ where: { courseId: course.id, bookingDate: fromDateKey(addDays(selected, -7)), status: { not: "cancelled" } } }),
    prisma.booking.groupBy({
      by: ["bookingDate"],
      where: { courseId: course.id, status: { not: "cancelled" }, bookingDate: { gte: fromDateKey(stripDays[0]), lte: fromDateKey(stripDays[6]) } },
      _sum: { numPlayers: true },
    }),
  ]);

  // Daily player capacity from the weekly slot templates (for fill rate).
  const capacityForDay = (dayKey: string) => {
    const dw = dayOfWeek(dayKey);
    let cap = 0;
    for (const l of layouts) {
      const t = l.teeTimeSlots.find((s) => s.dayOfWeek === dw && s.isActive);
      if (t) cap += slotTimes(t.startTime, t.endTime, t.intervalMin).length * t.maxPlayers;
    }
    return cap;
  };

  // Stats for the selected day
  const bookings = dayBookings.length;
  const players = dayBookings.reduce((n, b) => n + b.numPlayers, 0);
  const bkTrend = prevWeek.length > 0 ? Math.round(((bookings - prevWeek.length) / prevWeek.length) * 100) : null;
  const selCap = capacityForDay(selected);
  const fillToday = selCap > 0 ? Math.round((players / selCap) * 100) : 0;

  // Build the tee-sheet slots (a tee time can hold multiple groups up to max).
  const bookingsByKey = new Map<string, typeof dayBookings>();
  for (const b of dayBookings) {
    const k = `${b.layoutId}|${b.slotTime}`;
    const arr = bookingsByKey.get(k) ?? [];
    arr.push(b);
    bookingsByKey.set(k, arr);
  }
  const fullClosed = overrides.find((o) => !o.slotTime && o.isClosed);
  const closedSlots = new Map(overrides.filter((o) => o.slotTime).map((o) => [o.slotTime as string, o]));
  const dow = dayOfWeek(selected);
  const slots: Slot[] = [];
  if (!fullClosed) {
    for (const l of layouts) {
      const t = l.teeTimeSlots.find((s) => s.dayOfWeek === dow && s.isActive);
      if (!t) continue;
      for (const time of slotTimes(t.startTime, t.endTime, t.intervalMin)) {
        const arr = (bookingsByKey.get(`${l.id}|${time}`) ?? []).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        const ov = closedSlots.get(time);
        const maxPlayers = ov?.maxPlayers ?? t.maxPlayers;
        const booked = arr.reduce((n, b) => n + b.numPlayers, 0);
        const { label, ampm } = labelParts(time);
        slots.push({
          key: `${l.id}|${time}`, layoutId: l.id, layoutName: l.name, time, label, ampm,
          maxPlayers, spotsLeft: Math.max(0, maxPlayers - booked),
          closed: !!(ov && ov.isClosed), reason: ov?.reason ?? undefined,
          bookings: arr.map((b) => toLite(b, course.timezone)),
        });
      }
    }
    slots.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : a.layoutName.localeCompare(b.layoutName)));
  }

  const niceDate = new Date(selected + "T00:00:00Z").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
  const qs = (d: string) => `/dashboard?date=${d}`;

  // Fill % per strip day: booked players / template capacity for that weekday.
  const stripBookedMap = new Map(stripBooked.map((r) => [toDateKey(r.bookingDate), r._sum.numPlayers ?? 0]));
  const strip = stripDays.map((d) => {
    const cap = capacityForDay(d);
    const booked = stripBookedMap.get(d) ?? 0;
    const fill = cap > 0 ? Math.min(100, Math.round((booked / cap) * 100)) : 0;
    return {
      key: d,
      dow: ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][dayOfWeek(d)],
      num: Number(d.slice(8, 10)),
      fill,
      barColor: fill >= 90 ? "#e0533a" : fill >= 70 ? "#e8a13d" : "#12a06f",
      selected: d === selected,
      isToday: d === today,
    };
  });

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Tee sheet</h1>
          <p className="mt-1 text-sm text-foreground/50">{niceDate} — {bookings} booked, {players} players.</p>
        </div>
        <a
          href={`/dashboard/print?date=${selected}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-foreground/70 transition hover:bg-black/[0.04]"
        >
          🖨 Print day
        </a>
      </div>

      {/* colorful stat cards */}
      <div className="mt-5 grid grid-cols-2 gap-3.5 md:grid-cols-4">
        <StatCard bg="#fdeee3" label="Fill rate" value={`${fillToday}%`} />
        <StatCard bg="#eaf7ef" label="Bookings" value={String(bookings)} trend={bkTrend} />
        <StatCard bg="#eaf1fb" label="Players" value={String(players)} />
        <StatCard bg="#eef7e9" label="Next 7 days" value={String(upcomingWeek)} sub="upcoming" />
      </div>

      {/* day navigation — a 7-day strip with fill bars around the selected day */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-bold">{niceDate}</h2>
        {selected !== today && (
          <Link href={qs(today)} className="rounded-full border border-black/10 bg-white px-4 py-1.5 text-sm font-semibold hover:bg-black/[0.03]">Jump to today</Link>
        )}
      </div>
      <div className="mt-3 flex items-stretch gap-1.5">
        <Link href={qs(addDays(selected, -1))} aria-label="Previous day" className="grid w-8 shrink-0 place-items-center rounded-[10px] border border-black/10 bg-white text-foreground/60 hover:bg-black/[0.03]">‹</Link>
        <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
          {strip.map((d) => (
            <Link
              key={d.key}
              href={qs(d.key)}
              className={`min-w-[64px] flex-1 rounded-[10px] border px-1 py-1.5 text-center transition ${
                d.selected ? "border-linx-green border-2 bg-white shadow-sm" : "border-black/10 bg-white hover:bg-black/[0.02]"
              }`}
            >
              <div className={`text-[10px] font-semibold ${d.selected ? "text-linx-green" : "text-foreground/45"}`}>
                {d.isToday ? "TODAY" : d.dow} {d.num}
              </div>
              <div className="mx-auto mt-1.5 h-[3px] w-4/5 overflow-hidden rounded-full bg-black/[0.07]">
                <div className="h-full rounded-full" style={{ width: `${d.fill}%`, background: d.barColor }} />
              </div>
            </Link>
          ))}
        </div>
        <Link href={qs(addDays(selected, 1))} aria-label="Next day" className="grid w-8 shrink-0 place-items-center rounded-[10px] border border-black/10 bg-white text-foreground/60 hover:bg-black/[0.03]">›</Link>
      </div>

      <TeeSheetClient date={selected} slots={slots} layouts={layouts.map((l) => ({ id: l.id, name: l.name }))} shopItems={shopItems} taxRateBps={course.taxRateBps} inPersonFeePerPlayer={course.linxtimesInPersonFee} timezone={course.timezone} />
    </div>
  );
}

function toLite(b: Booking, tz: string) {
  const refundCents = b.paymentStatus === "paid_online" ? refundableCents(b.totalCents, b.bookingFeeCents) : 0;
  const withinCancelWindow = hoursUntilTeeTime(toDateKey(b.bookingDate), b.slotTime, tz) < CANCELLATION_WINDOW_HOURS;
  return {
    id: b.id, golferName: b.golferName, golferEmail: b.golferEmail, golferPhone: b.golferPhone,
    numPlayers: b.numPlayers, holes: b.holes, withCart: b.withCart, source: b.source, memberCount: b.memberCount,
    paymentStatus: b.paymentStatus, status: b.status, totalCents: b.totalCents, amountPaidCents: b.amountPaidCents,
    taxCents: b.taxCents, notes: b.notes, refundCents, withinCancelWindow,
  };
}

function StatCard({ bg, label, value, trend, sub }: { bg: string; label: string; value: string; trend?: number | null; sub?: string }) {
  return (
    <div className="rounded-2xl p-[18px]" style={{ background: bg }}>
      <div className="text-xs font-medium text-[#6b7280]">{label}</div>
      <div className="mt-2 font-mono text-2xl font-bold text-[#1c2430]">{value}</div>
      {trend != null ? (
        <div className={`mt-2.5 text-xs font-semibold ${trend >= 0 ? "text-[#16a34a]" : "text-[#e0533a]"}`}>{trend >= 0 ? "▲" : "▼"} {Math.abs(trend)}% <span className="font-medium text-[#9aa1ab]">vs last wk</span></div>
      ) : sub ? (
        <div className="mt-2.5 text-xs font-medium text-[#9aa1ab]">{sub}</div>
      ) : (
        <div className="mt-2.5 h-4" />
      )}
    </div>
  );
}

