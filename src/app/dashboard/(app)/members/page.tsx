import { requireCourseAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { MembersManager } from "./MembersManager";
import { EnrollMemberForm } from "./_components/EnrollMemberForm";

export default async function MembersPage() {
  const { course } = await requireCourseAdmin();
  const [members, membershipTiers] = await Promise.all([
    prisma.member.findMany({
      where: { courseId: course.id },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.membershipTier.findMany({
      where: { courseId: course.id, isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      {membershipTiers.length > 0 && (
        <EnrollMemberForm course={course} membershipTiers={membershipTiers} />
      )}

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
