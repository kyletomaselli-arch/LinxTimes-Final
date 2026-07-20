import { requireSuperAdmin } from "@/lib/super-session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  await requireSuperAdmin();

  const courses = await prisma.course.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return Response.json(courses);
}
