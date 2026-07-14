import type { NextRequest } from "next/server";
import { requireCourseAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { fromDateKey, toDateKey, formatTimeLabel } from "@/lib/datetime";
import type { Prisma } from "@/generated/prisma";

/**
 * GET /dashboard/bookings/export — CSV of the current course's bookings,
 * honoring the same filters as the Bookings table. Protected by the admin
 * session and scoped to the admin's course.
 */
export async function GET(request: NextRequest) {
  const { course, admin } = await requireCourseAdmin();
  const canSeeRevenue = admin.role !== "staff";
  const sp = new URL(request.url).searchParams;

  const where: Prisma.BookingWhereInput = { courseId: course.id };
  const from = sp.get("from");
  const to = sp.get("to");
  if (from || to) {
    where.bookingDate = {};
    if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) where.bookingDate.gte = fromDateKey(from);
    if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) where.bookingDate.lte = fromDateKey(to);
  }
  const status = sp.get("status");
  const source = sp.get("source");
  const payment = sp.get("payment");
  const q = sp.get("q")?.trim();
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
    take: 5000,
  });

  const money = canSeeRevenue ? ["GreenFee", "CartFee", "LinxFee", "Tax", "Total"] : [];
  const headers = [
    "Confirmation", "Date", "Time", "Layout", "Golfer", "Email", "Phone",
    "Players", "Members", "Holes", "Cart", "RateType", ...money,
    "PaymentStatus", "Status", "Source", "CreatedAt",
  ];
  const cents = (c: number) => (c / 100).toFixed(2);
  const rows = bookings.map((b) => [
    b.confirmationNo, toDateKey(b.bookingDate), formatTimeLabel(b.slotTime), b.layout.name,
    b.golferName, b.golferEmail, b.golferPhone ?? "", String(b.numPlayers), String(b.memberCount), String(b.holes),
    b.withCart ? "yes" : "no", b.rateType,
    ...(canSeeRevenue ? [cents(b.greenFeeCents), cents(b.cartFeeCents), cents(b.bookingFeeCents), cents(b.taxCents), cents(b.totalCents)] : []),
    b.paymentStatus, b.status, b.source, b.createdAt.toISOString(),
  ]);

  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const csv = [headers, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bookings-${course.slug}-${toDateKey(new Date())}.csv"`,
    },
  });
}
