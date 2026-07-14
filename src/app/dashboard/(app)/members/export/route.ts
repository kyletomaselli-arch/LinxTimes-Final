import { requireCourseAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { toDateKey } from "@/lib/datetime";

/** GET /dashboard/members/export — CSV of the course's members. */
export async function GET() {
  const { course } = await requireCourseAdmin();
  const members = await prisma.member.findMany({
    where: { courseId: course.id },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const headers = [
    "memberId", "firstName", "lastName", "email", "phone",
    "membershipType", "greenFeeOverride", "cartIncluded", "discountDays", "isActive",
  ];
  const rows = members.map((m) => [
    m.memberId, m.firstName, m.lastName, m.email ?? "", m.phone ?? "",
    m.membershipType, m.greenFeeOverride != null ? (m.greenFeeOverride / 100).toFixed(2) : "",
    m.cartIncluded ? "yes" : "no", m.discountDays, m.isActive ? "yes" : "no",
  ]);
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const csv = [headers, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="members-${course.slug}-${toDateKey(new Date())}.csv"`,
    },
  });
}
