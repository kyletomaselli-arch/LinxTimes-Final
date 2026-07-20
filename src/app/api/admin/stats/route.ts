import { requireSuperAdmin } from "@/lib/super-session";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  await requireSuperAdmin();

  const url = new URL(req.url);
  const startDate = url.searchParams.get("startDate");
  const endDate = url.searchParams.get("endDate");
  const courseId = url.searchParams.get("courseId");

  // Build date filters
  const dateFilter: any = {};
  if (startDate) dateFilter.gte = new Date(startDate);
  if (endDate) {
    const end = new Date(endDate);
    end.setDate(end.getDate() + 1);
    dateFilter.lt = end;
  }

  const bookingWhere: any = {};
  if (Object.keys(dateFilter).length > 0) bookingWhere.bookingDate = dateFilter;
  if (courseId) bookingWhere.courseId = courseId;

  // Payment filter (through booking relation)
  const paymentWhere: any = {};
  if (courseId) paymentWhere.courseId = courseId;
  if (Object.keys(dateFilter).length > 0) {
    paymentWhere.booking = { bookingDate: dateFilter };
  }

  // Fetch courses for reference
  const courses = await prisma.course.findMany({ select: { id: true, name: true } });

  // Fees from active online bookings
  const activeOnlineFees = await prisma.payment.groupBy({
    by: ["courseId"],
    where: { ...paymentWhere, booking: { status: { not: "cancelled" }, paymentStatus: { in: ["paid_online", "refunded"] } } },
    _sum: { feeCents: true },
  });

  // Fees from active in-person bookings
  const activeInPersonFees = await prisma.payment.groupBy({
    by: ["courseId"],
    where: { ...paymentWhere, booking: { status: { not: "cancelled" }, paymentStatus: { in: ["paid_in_person", "partially_paid"] } } },
    _sum: { feeCents: true },
  });

  // Fees from cancelled online bookings (retained)
  const cancelledOnlineFees = await prisma.payment.groupBy({
    by: ["courseId"],
    where: { ...paymentWhere, booking: { status: "cancelled", paymentStatus: { in: ["paid_online", "refunded"] } } },
    _sum: { feeCents: true },
  });

  // Fees from cancelled in-person bookings (retained)
  const cancelledInPersonFees = await prisma.payment.groupBy({
    by: ["courseId"],
    where: { ...paymentWhere, booking: { status: "cancelled", paymentStatus: { in: ["paid_in_person", "partially_paid"] } } },
    _sum: { feeCents: true },
  });

  // Query booking counts for context
  const onlineBookings = await prisma.booking.groupBy({
    by: ["courseId"],
    where: { ...bookingWhere, paymentStatus: { in: ["paid_online", "refunded"] } },
    _count: { _all: true },
  });

  const inPersonBookings = await prisma.booking.groupBy({
    by: ["courseId"],
    where: { ...bookingWhere, paymentStatus: { in: ["paid_in_person", "partially_paid"] } },
    _count: { _all: true },
  });

  const cancelledBookings = await prisma.booking.groupBy({
    by: ["courseId"],
    where: { ...bookingWhere, status: "cancelled" },
    _count: { _all: true },
  });

  // Build maps
  const activeOnlineFeesMap = new Map(activeOnlineFees.map((r) => [r.courseId, r._sum.feeCents ?? 0]));
  const activeInPersonFeesMap = new Map(activeInPersonFees.map((r) => [r.courseId, r._sum.feeCents ?? 0]));
  const cancelOnlineFeesMap = new Map(cancelledOnlineFees.map((r) => [r.courseId, r._sum.feeCents ?? 0]));
  const cancelInPersonFeesMap = new Map(cancelledInPersonFees.map((r) => [r.courseId, r._sum.feeCents ?? 0]));
  const onlineMap = new Map(onlineBookings.map((r) => [r.courseId, r._count._all]));
  const inPersonMap = new Map(inPersonBookings.map((r) => [r.courseId, r._count._all]));
  const cancelMap = new Map(cancelledBookings.map((r) => [r.courseId, r._count._all]));

  // Build rows
  const rows = courses.map((c) => {
    const onlineBookingFees = activeOnlineFeesMap.get(c.id) ?? 0;
    const inPersonBookingFees = activeInPersonFeesMap.get(c.id) ?? 0;
    const onlineCancelledFees = cancelOnlineFeesMap.get(c.id) ?? 0;
    const inPersonCancelledFees = cancelInPersonFeesMap.get(c.id) ?? 0;
    const onlineCount = onlineMap.get(c.id) ?? 0;
    const inPersonCount = inPersonMap.get(c.id) ?? 0;
    const cancelCount = cancelMap.get(c.id) ?? 0;

    return {
      courseId: c.id,
      courseName: c.name,
      onlineBookings: onlineCount,
      inPersonBookings: inPersonCount,
      cancelBookings: cancelCount,
      onlineBookingFees,
      inPersonBookingFees,
      onlineCancelledFees,
      inPersonCancelledFees,
    };
  });

  // Calculate totals
  const totals = {
    onlineBookings: rows.reduce((sum, r) => sum + r.onlineBookings, 0),
    inPersonBookings: rows.reduce((sum, r) => sum + r.inPersonBookings, 0),
    cancelBookings: rows.reduce((sum, r) => sum + r.cancelBookings, 0),
    onlineBookingFees: rows.reduce((sum, r) => sum + r.onlineBookingFees, 0),
    inPersonBookingFees: rows.reduce((sum, r) => sum + r.inPersonBookingFees, 0),
    onlineCancelledFees: rows.reduce((sum, r) => sum + r.onlineCancelledFees, 0),
    inPersonCancelledFees: rows.reduce((sum, r) => sum + r.inPersonCancelledFees, 0),
    totalEarned: 0,
  };

  // Total fees earned
  totals.totalEarned = totals.onlineBookingFees + totals.inPersonBookingFees + totals.onlineCancelledFees + totals.inPersonCancelledFees;

  return Response.json({ rows, totals });
}
