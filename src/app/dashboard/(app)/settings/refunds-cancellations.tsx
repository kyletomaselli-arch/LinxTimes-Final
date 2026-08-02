import { requireCourseAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatCentsCompact } from "@/lib/money";
import { formatTimeLabel } from "@/lib/datetime";

export default async function RefundsCancellationsPage() {
  const { course } = await requireCourseAdmin();

  const cancellations = await prisma.booking.findMany({
    where: {
      courseId: course.id,
      cancelledAt: { not: null }
    },
    orderBy: { cancelledAt: "desc" },
    take: 100
  });

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold text-foreground">Refunds & Cancellations</h1>
      <p className="mt-1 text-sm text-foreground/55">History of all cancelled bookings and refunds issued.</p>

      <div className="mt-6 rounded-2xl bg-white shadow-[0_18px_40px_-34px_rgba(16,50,34,0.4)] overflow-hidden">
        {cancellations.length === 0 ? (
          <div className="p-8 text-center text-sm text-foreground/60">
            No cancellations yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/5 text-left text-xs uppercase tracking-wide text-foreground/45">
                <th className="px-4 py-3 font-semibold">Golfer</th>
                <th className="px-4 py-3 font-semibold">Booking date</th>
                <th className="px-4 py-3 font-semibold">Cancelled</th>
                <th className="px-4 py-3 font-semibold">Reason</th>
                <th className="px-4 py-3 font-semibold text-right">Refunded</th>
              </tr>
            </thead>
            <tbody>
              {cancellations.map((b) => {
                const refundAmount = b.amountPaidCents - (b.paymentStatus === "refunded" ? Math.round((b.totalCents * (course.cancellationFeeBps ?? 0)) / 10000) : 0);
                return (
                  <tr key={b.id} className="border-b border-black/[0.04] last:border-0 hover:bg-black/[0.015]">
                    <td className="px-4 py-3">
                      <div className="font-medium">{b.golferName}</div>
                      <div className="text-xs text-foreground/45">{b.confirmationNo}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm">{b.bookingDate.toLocaleDateString()}</div>
                      <div className="text-xs text-foreground/45">{b.slotTime}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-foreground/60">
                      {b.cancelledAt?.toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs max-w-xs">
                        {b.cancellationReason ? (
                          <>
                            <span className="block font-medium">{b.cancellationOverride ? "Staff override" : "Auto-cancelled"}</span>
                            <span className="block text-foreground/60">{b.cancellationReason}</span>
                          </>
                        ) : (
                          <span className="text-foreground/45">No reason provided</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="font-medium text-green-700">{formatCentsCompact(refundAmount)}</div>
                      <div className="text-xs text-foreground/45">{b.numPlayers} player{b.numPlayers !== 1 ? "s" : ""}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-6 rounded-2xl bg-black/[0.02] p-5">
        <h3 className="font-semibold text-foreground">Summary</h3>
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <div className="text-xs text-foreground/55">Total cancellations</div>
            <div className="text-2xl font-bold text-foreground">{cancellations.length}</div>
          </div>
          <div>
            <div className="text-xs text-foreground/55">Total refunded</div>
            <div className="text-2xl font-bold text-green-700">
              {formatCentsCompact(
                cancellations.reduce((sum, b) => {
                  const refund = b.amountPaidCents - (b.paymentStatus === "refunded" ? Math.round((b.totalCents * (course.cancellationFeeBps ?? 0)) / 10000) : 0);
                  return sum + refund;
                }, 0)
              )}
            </div>
          </div>
          <div>
            <div className="text-xs text-foreground/55">Cancellation fee rate</div>
            <div className="text-2xl font-bold text-foreground">{((course.cancellationFeeBps ?? 0) / 100).toFixed(1)}%</div>
          </div>
        </div>
      </div>
    </div>
  );
}
