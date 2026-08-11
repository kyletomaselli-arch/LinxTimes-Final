import { requireCourseAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { formatTimeLabel, toDateKey, addDays } from "@/lib/datetime";
import { formatCentsCompact } from "@/lib/money";

export default async function ActivityPage() {
  const { course } = await requireCourseAdmin();

  const today = toDateKey(new Date());
  const sevenDaysAgo = addDays(today, -7);

  const [unpaidBookings, cancellations, recentPayments] = await Promise.all([
    prisma.booking.findMany({
      where: {
        courseId: course.id,
        bookingDate: {
          gte: new Date(sevenDaysAgo),
          lt: new Date(today),
        },
        paymentStatus: "unpaid",
        source: "phone",
      },
      orderBy: { bookingDate: "desc" },
    }),
    prisma.booking.findMany({
      where: {
        courseId: course.id,
        cancelledAt: { not: null }
      },
      orderBy: { cancelledAt: "desc" },
      take: 20
    }),
    prisma.payment.findMany({
      where: { courseId: course.id },
      include: { booking: true },
      orderBy: { createdAt: "desc" },
      take: 15
    }),
  ]);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
  };

  return (
    <div className="space-y-6">
      {/* Unpaid Bookings */}
      <div className="rounded-2xl bg-white shadow-[0_18px_40px_-34px_rgba(16,50,34,0.4)]">
        <div className="border-b border-black/[0.06] px-6 py-4">
          <h2 className="text-lg font-semibold">Unpaid Phone Bookings</h2>
          <p className="text-sm text-foreground/55">From the past week that were never paid</p>
        </div>

        <div className="divide-y divide-black/[0.06]">
          {unpaidBookings.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-foreground/55">No unpaid phone bookings from the past week</p>
            </div>
          ) : (
            unpaidBookings.map((booking) => (
              <Link
                key={booking.id}
                href={`/dashboard/bookings`}
                className="block px-6 py-4 transition hover:bg-black/[0.02]"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">{booking.golferName}</p>
                    <p className="text-sm text-foreground/55">
                      {formatTimeLabel(booking.slotTime)} · {booking.bookingDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-foreground">{formatCurrency(booking.totalCents)}</p>
                    <p className="text-xs text-foreground/55">Conf: {booking.confirmationNo}</p>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      {/* Recent Payments */}
      <div className="rounded-2xl bg-white shadow-[0_18px_40px_-34px_rgba(16,50,34,0.4)] overflow-hidden">
        <div className="border-b border-black/[0.06] px-6 py-4">
          <h2 className="text-lg font-semibold">Recent Payments</h2>
          <p className="text-sm text-foreground/55">Latest charges taken</p>
        </div>

        {recentPayments.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-foreground/60">
            No recent payments.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/5 text-left text-xs uppercase tracking-wide text-foreground/45">
                <th className="px-6 py-3 font-semibold">Time</th>
                <th className="px-6 py-3 font-semibold">Method</th>
                <th className="px-6 py-3 font-semibold">Booking</th>
                <th className="px-6 py-3 font-semibold text-right">Amount</th>
                <th className="px-6 py-3 font-semibold text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentPayments.map((payment) => (
                <tr key={payment.id} className="border-b border-black/[0.04] last:border-0 hover:bg-black/[0.015]">
                  <td className="px-6 py-3 whitespace-nowrap text-xs">
                    {payment.createdAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })} · {payment.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </td>
                  <td className="px-6 py-3 capitalize text-xs">{payment.method}</td>
                  <td className="px-6 py-3">
                    {payment.booking ? (
                      <div>
                        <div className="font-medium">{payment.booking.golferName}</div>
                        <div className="text-xs text-foreground/45">{payment.booking.confirmationNo}</div>
                      </div>
                    ) : (
                      <span className="text-foreground/55">—</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-right font-semibold">{formatCurrency(payment.amountCents)}</td>
                  <td className="px-6 py-3 text-right">
                    <span className={`text-xs font-medium ${
                      payment.state === "succeeded" ? "text-green-600" :
                      payment.state === "failed" ? "text-red-600" :
                      payment.state === "refunded" ? "text-gray-600" :
                      "text-yellow-600"
                    }`}>
                      {payment.state.replace("_", " ")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Refunds & Cancellations */}
      <div className="rounded-2xl bg-white shadow-[0_18px_40px_-34px_rgba(16,50,34,0.4)] overflow-hidden">
        <div className="border-b border-black/[0.06] px-6 py-4">
          <h2 className="text-lg font-semibold">Recent Cancellations & Refunds</h2>
          <p className="text-sm text-foreground/55">Latest cancelled bookings</p>
        </div>

        {cancellations.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-foreground/60">
            No cancellations yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/5 text-left text-xs uppercase tracking-wide text-foreground/45">
                <th className="px-6 py-3 font-semibold">Golfer</th>
                <th className="px-6 py-3 font-semibold">Booking date</th>
                <th className="px-6 py-3 font-semibold">Cancelled</th>
                <th className="px-6 py-3 font-semibold">Reason</th>
                <th className="px-6 py-3 font-semibold text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {cancellations.map((b) => (
                <tr key={b.id} className="border-b border-black/[0.04] last:border-0 hover:bg-black/[0.015]">
                  <td className="px-6 py-3">
                    <div className="font-medium">{b.golferName}</div>
                    <div className="text-xs text-foreground/45">{b.confirmationNo}</div>
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap">
                    <div className="text-sm">{b.bookingDate.toLocaleDateString()}</div>
                    <div className="text-xs text-foreground/45">{b.slotTime}</div>
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap">
                    <div className="text-sm">{b.cancelledAt?.toLocaleDateString()}</div>
                  </td>
                  <td className="px-6 py-3 text-xs text-foreground/60 max-w-xs truncate">{b.cancellationReason || "—"}</td>
                  <td className="px-6 py-3 text-right font-medium">{formatCurrency(b.amountPaidCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="border-t border-black/[0.06] px-6 py-3 bg-black/[0.01]">
          <Link href="/dashboard/bookings/refunds-cancellations" className="text-sm font-medium text-course hover:underline">
            View all refunds & cancellations →
          </Link>
        </div>
      </div>
    </div>
  );
}
