import { requireSuperAdmin } from "@/lib/super-session";
import { prisma } from "@/lib/prisma";
import { formatCentsCompact } from "@/lib/money";

export default async function StatsPage() {
  await requireSuperAdmin();

  const [courses, revenueByCourse, cancelByCourse] = await Promise.all([
    prisma.course.findMany({ select: { id: true, name: true, linxtimesFee: true } }),
    // Fee earned + players on bookings LinxTimes collected on (paid or refunded —
    // the convenience fee is kept even after a refund).
    prisma.booking.groupBy({
      by: ["courseId"],
      where: { paymentStatus: { in: ["paid_online", "refunded"] } },
      _sum: { bookingFeeCents: true, numPlayers: true },
      _count: { _all: true },
    }),
    prisma.booking.groupBy({
      by: ["courseId"],
      where: { status: "cancelled" },
      _sum: { bookingFeeCents: true },
      _count: { _all: true },
    }),
  ]);

  const revMap = new Map(revenueByCourse.map((r) => [r.courseId, r]));
  const cancelMap = new Map(cancelByCourse.map((r) => [r.courseId, r]));

  const rows = courses
    .map((c) => {
      const rev = revMap.get(c.id);
      const can = cancelMap.get(c.id);
      return {
        name: c.name,
        bookings: rev?._count._all ?? 0,
        players: rev?._sum.numPlayers ?? 0,
        feeEarned: rev?._sum.bookingFeeCents ?? 0,
        cancellations: can?._count._all ?? 0,
        feesRetainedOnCancel: can?._sum.bookingFeeCents ?? 0,
      };
    })
    .sort((a, b) => b.feeEarned - a.feeEarned);

  const totals = rows.reduce(
    (t, r) => ({
      bookings: t.bookings + r.bookings,
      players: t.players + r.players,
      feeEarned: t.feeEarned + r.feeEarned,
      cancellations: t.cancellations + r.cancellations,
    }),
    { bookings: 0, players: 0, feeEarned: 0, cancellations: 0 }
  );

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-3xl font-semibold text-foreground">Platform stats</h1>
      <p className="mt-1 text-sm text-foreground/55">All-time across every course.</p>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat bg="#fdeee3" label="LinxTimes revenue" value={formatCentsCompact(totals.feeEarned)} />
        <Stat bg="#eaf7ef" label="Paid bookings" value={String(totals.bookings)} />
        <Stat bg="#eaf1fb" label="Players charged" value={String(totals.players)} />
        <Stat bg="#eef7e9" label="Cancellations" value={String(totals.cancellations)} />
      </div>

      <h2 className="mt-9 font-display text-xl font-semibold text-foreground">By course</h2>
      <div className="mt-3 overflow-hidden rounded-2xl bg-white shadow-[0_18px_40px_-34px_rgba(16,50,34,0.4)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/5 text-left text-xs uppercase tracking-wide text-foreground/45">
              <th className="px-4 py-3 font-semibold">Course</th>
              <th className="px-4 py-3 font-semibold">Bookings</th>
              <th className="px-4 py-3 font-semibold">Players</th>
              <th className="px-4 py-3 font-semibold">Fee earned</th>
              <th className="px-4 py-3 font-semibold">Cancels</th>
              <th className="px-4 py-3 font-semibold">Fees kept on cancel</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-b border-black/[0.04] last:border-0">
                <td className="px-4 py-3 font-medium">{r.name}</td>
                <td className="px-4 py-3 text-foreground/70">{r.bookings}</td>
                <td className="px-4 py-3 text-foreground/70">{r.players}</td>
                <td className="px-4 py-3 font-medium">{formatCentsCompact(r.feeEarned)}</td>
                <td className="px-4 py-3 text-foreground/70">{r.cancellations}</td>
                <td className="px-4 py-3 text-foreground/70">{formatCentsCompact(r.feesRetainedOnCancel)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, bg }: { label: string; value: string; bg: string }) {
  return (
    <div className="rounded-2xl p-[18px]" style={{ background: bg }}>
      <div className="text-xs font-medium text-[#6b7280]">{label}</div>
      <div className="mt-2 font-mono text-2xl font-bold text-[#1c2430]">{value}</div>
    </div>
  );
}
