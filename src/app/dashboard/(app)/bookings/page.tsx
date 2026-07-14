import { Fragment } from "react";
import { requireCourseAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { fromDateKey, formatTimeLabel, toDateKey } from "@/lib/datetime";
import { formatCentsCompact } from "@/lib/money";
import { CancelBookingButton } from "../../_components/CancelBookingButton";
import { StatusBadge, PaymentBadge } from "../../_components/badges";
import type { Prisma } from "@/generated/prisma";

export default async function BookingsPage(props: PageProps<"/dashboard/bookings">) {
  const { course, admin } = await requireCourseAdmin();
  const canSeeRevenue = admin.role !== "staff";
  const sp = await props.searchParams;

  const get = (k: string) => {
    const v = sp[k];
    return typeof v === "string" ? v : "";
  };
  const from = get("from");
  const to = get("to");
  const status = get("status");
  const source = get("source");
  const payment = get("payment");
  const q = get("q").trim();

  const where: Prisma.BookingWhereInput = { courseId: course.id };
  if (from || to) {
    where.bookingDate = {};
    if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) where.bookingDate.gte = fromDateKey(from);
    if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) where.bookingDate.lte = fromDateKey(to);
  }
  if (status) where.status = status as Prisma.BookingWhereInput["status"];
  if (source) where.source = source as Prisma.BookingWhereInput["source"];
  if (payment) where.paymentStatus = payment as Prisma.BookingWhereInput["paymentStatus"];
  if (q) {
    where.OR = [
      { golferName: { contains: q, mode: "insensitive" } },
      { golferEmail: { contains: q, mode: "insensitive" } },
      { confirmationNo: { contains: q, mode: "insensitive" } },
    ];
  }

  const bookings = await prisma.booking.findMany({
    where,
    include: { layout: true },
    orderBy: [{ bookingDate: "desc" }, { slotTime: "asc" }],
    take: 200,
  });

  const exportQs = new URLSearchParams(
    Object.fromEntries(
      Object.entries({ from, to, status, source, payment, q }).filter(([, v]) => v)
    )
  ).toString();

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-semibold text-foreground">Bookings</h1>
        <a
          href={`/dashboard/bookings/export${exportQs ? `?${exportQs}` : ""}`}
          className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-foreground/70 transition hover:bg-black/[0.04]"
        >
          Export CSV
        </a>
      </div>

      {/* Filters (GET form → URL params) */}
      <form className="mt-5 grid grid-cols-2 gap-3 rounded-2xl bg-white shadow-[0_18px_40px_-34px_rgba(16,50,34,0.4)] p-4 sm:grid-cols-3 lg:grid-cols-6">
        <Field label="From"><input type="date" name="from" defaultValue={from} className={inputCls} /></Field>
        <Field label="To"><input type="date" name="to" defaultValue={to} className={inputCls} /></Field>
        <Field label="Status">
          <select name="status" defaultValue={status} className={inputCls}>
            <option value="">Any</option>
            <option value="confirmed">Confirmed</option>
            <option value="checked_in">Checked in</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No-show</option>
          </select>
        </Field>
        <Field label="Source">
          <select name="source" defaultValue={source} className={inputCls}>
            <option value="">Any</option>
            <option value="online">Online</option>
            <option value="walkin">Walk-in</option>
            <option value="phone">Phone</option>
          </select>
        </Field>
        <Field label="Payment">
          <select name="payment" defaultValue={payment} className={inputCls}>
            <option value="">Any</option>
            <option value="paid_online">Paid online</option>
            <option value="paid_in_person">Paid at counter</option>
            <option value="partially_paid">Part-paid</option>
            <option value="unpaid">Unpaid</option>
            <option value="refunded">Refunded</option>
          </select>
        </Field>
        <Field label="Search">
          <input name="q" defaultValue={q} placeholder="Name, email, conf #" className={inputCls} />
        </Field>
        <div className="col-span-2 flex gap-2 sm:col-span-3 lg:col-span-6">
          <button className="rounded-full bg-course px-5 py-2 text-sm font-semibold text-course-contrast">Apply filters</button>
          <a href="/dashboard/bookings" className="rounded-full px-4 py-2 text-sm font-medium text-foreground/60 hover:bg-black/[0.04]">Clear</a>
        </div>
      </form>

      <div className="mt-5 overflow-hidden rounded-2xl bg-white shadow-[0_18px_40px_-34px_rgba(16,50,34,0.4)]">
        {bookings.length === 0 ? (
          <div className="py-16 text-center text-sm text-foreground/50">No bookings match these filters.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/5 text-left text-xs uppercase tracking-wide text-foreground/45">
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Time</th>
                <th className="px-4 py-3 font-semibold">Golfer</th>
                <th className="px-4 py-3 font-semibold">Course</th>
                {canSeeRevenue && <th className="px-4 py-3 font-semibold">Total</th>}
                <th className="px-4 py-3 font-semibold">Payment</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Src</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {bookings.map((b, i) => {
                const dateKey = toDateKey(b.bookingDate);
                const newDay = i === 0 || dateKey !== toDateKey(bookings[i - 1].bookingDate);
                const cols = canSeeRevenue ? 9 : 8;
                return (
                  <Fragment key={b.id}>
                    {newDay && (
                      <tr className="bg-black/[0.025]">
                        <td colSpan={cols} className="px-4 py-2 text-xs font-semibold text-foreground/60">
                          {dayHeading(dateKey)}
                        </td>
                      </tr>
                    )}
                    <tr className="border-b border-black/[0.04] last:border-0 hover:bg-black/[0.015]">
                      <td className="px-4 py-3 whitespace-nowrap text-foreground/70">{dateKey}</td>
                      <td className="px-4 py-3 whitespace-nowrap font-medium">{formatTimeLabel(b.slotTime)}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{b.golferName}</div>
                        <div className="text-xs text-foreground/45">
                          {b.confirmationNo} · {b.numPlayers}p · {b.holes}H · {b.withCart ? "🛺 Cart" : "🚶 Walk"}
                          {b.memberCount > 0 ? ` · ★ ${b.memberCount} member${b.memberCount === 1 ? "" : "s"}` : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-foreground/70">{b.layout.name}</td>
                      {canSeeRevenue && <td className="px-4 py-3 whitespace-nowrap">{formatCentsCompact(b.totalCents)}</td>}
                      <td className="px-4 py-3"><PaymentBadge status={b.paymentStatus} /></td>
                      <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                      <td className="px-4 py-3 text-xs capitalize text-foreground/60">{b.source}</td>
                      <td className="px-4 py-3 text-right">
                        {b.status !== "cancelled" && <CancelBookingButton bookingId={b.id} />}
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {bookings.length === 200 && (
        <p className="mt-3 text-center text-xs text-foreground/45">Showing the most recent 200. Narrow the filters or export CSV for the full set.</p>
      )}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none transition focus:border-course focus:ring-2 focus:ring-course/25";

/** Full, readable date heading for a bookings group, e.g. "Thursday, July 16, 2026". */
function dayHeading(dateKey: string): string {
  return new Date(dateKey + "T00:00:00Z").toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
  });
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-foreground/45">{label}</span>
      {children}
    </label>
  );
}
