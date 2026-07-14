import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
async function main() {
  const email = "owner@pinevalley.example.com";
  const course = await prisma.course.findFirst({ where: { email, status: "approved" } });
  const admins = course ? await prisma.courseAdmin.count({ where: { courseId: course.id } }) : -1;
  console.log("Eligible course found:", course?.name ?? "NONE");
  console.log("Existing admins (0 = claimable):", admins);
  console.log("Eligible to onboard:", !!course && admins === 0);
}
main().finally(() => prisma.$disconnect());
