import { requireCourseAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { todayKeyInTz, fromDateKey, formatTimeLabel } from "@/lib/datetime";
import { PrintButton } from "./PrintButton";

/** Clean, print-friendly tee sheet for a single day (no dashboard chrome). */
export default async function PrintTeeSheet(props: PageProps<"/dashboard/print">) {
  const { course } = await requireCourseAdmin();
  const sp = await props.searchParams;
  const today = todayKeyInTz(course.timezone);
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;

  const bookings = await prisma.booking.findMany({
    where: { courseId: course.id, bookingDate: fromDateKey(date), status: { not: "cancelled" } },
    include: { layout: true },
    orderBy: [{ slotTime: "asc" }],
  });

  const niceDate = new Date(date + "T00:00:00Z").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
  });
  const players = bookings.reduce((n, b) => n + b.numPlayers, 0);
  const payLabel = (s: string) =>
    s === "paid_online" ? "Paid (online)" : s === "paid_in_person" ? "Paid (counter)" :
    s === "partially_paid" ? "Part-paid" : s === "refunded" ? "Refunded" : "Unpaid";

  return (
    <main className="mx-auto max-w-4xl bg-white p-8 text-black">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{course.name}</h1>
          <p className="text-sm text-gray-600">Tee sheet · {niceDate}</p>
        </div>
        <PrintButton />
      </div>
      <p className="mt-1 text-sm text-gray-600">{bookings.length} bookings · {players} players</p>

      {bookings.length === 0 ? (
        <p className="mt-8 text-gray-500">No bookings for this day.</p>
      ) : (
        <table className="mt-5 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-black text-left">
              <th className="py-2 pr-3">Time</th>
              <th className="py-2 pr-3">Course</th>
              <th className="py-2 pr-3">Golfer</th>
              <th className="py-2 pr-3">Players</th>
              <th className="py-2 pr-3">Holes</th>
              <th className="py-2 pr-3">Cart</th>
              <th className="py-2 pr-3">Payment</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id} className="border-b border-gray-300">
                <td className="py-2 pr-3 font-semibold whitespace-nowrap">{formatTimeLabel(b.slotTime)}</td>
                <td className="py-2 pr-3">{b.layout.name}</td>
                <td className="py-2 pr-3">{b.golferName}{b.memberCount > 0 ? ` (★${b.memberCount})` : ""}</td>
                <td className="py-2 pr-3">{b.numPlayers}</td>
                <td className="py-2 pr-3">{b.holes}</td>
                <td className="py-2 pr-3">{b.withCart ? "Cart" : "Walk"}</td>
                <td className="py-2 pr-3">{payLabel(b.paymentStatus)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="mt-8 text-xs text-gray-400 print:hidden">
        Tip: use your browser&apos;s print dialog to save as PDF or send to a printer.
      </p>
    </main>
  );
}
