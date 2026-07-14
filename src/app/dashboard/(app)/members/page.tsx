import { requireCourseAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { MembersManager } from "./MembersManager";

export default async function MembersPage() {
  const { course } = await requireCourseAdmin();
  const members = await prisma.member.findMany({
    where: { courseId: course.id },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return (
    <div className="mx-auto max-w-6xl">
      <MembersManager
        members={members.map((m) => ({
          id: m.id,
          memberId: m.memberId,
          firstName: m.firstName,
          lastName: m.lastName,
          email: m.email,
          phone: m.phone,
          membershipType: m.membershipType,
          greenFeeOverride: m.greenFeeOverride,
          cartIncluded: m.cartIncluded,
          discountDays: m.discountDays,
          isActive: m.isActive,
          notes: m.notes,
        }))}
      />
    </div>
  );
}
