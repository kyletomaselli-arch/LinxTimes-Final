import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./src/generated/prisma";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function findEmail() {
  const email = "kyle.tomaselli@gmail.com";
  console.log(`🔍 Searching for ${email}...\n`);

  try {
    // Check all possible places
    const superAdmins = await prisma.superAdmin.findMany({
      where: { email },
    });

    const courseAdmins = await prisma.courseAdmin.findMany({
      where: { email },
    });

    const bookings = await prisma.booking.findMany({
      where: { golferEmail: email },
      include: { course: true },
    });

    const members = await prisma.member.findMany({
      where: { email },
      include: { course: true },
    });

    console.log("Results:\n");

    if (superAdmins.length > 0) {
      console.log(`📌 Found in SuperAdmin (${superAdmins.length}):`);
      superAdmins.forEach(sa => console.log(`   - ${sa.email} (ID: ${sa.id})`));
      console.log();
    }

    if (courseAdmins.length > 0) {
      console.log(`📌 Found in CourseAdmin (${courseAdmins.length}):`);
      courseAdmins.forEach(ca => console.log(`   - ${ca.email} for course (ID: ${ca.courseId})`));
      console.log();
    }

    if (bookings.length > 0) {
      console.log(`📌 Found in Bookings (${bookings.length}):`);
      bookings.forEach(b => console.log(`   - ${b.golferEmail} for ${b.course.name}`));
      console.log();
    }

    if (members.length > 0) {
      console.log(`📌 Found in Members (${members.length}):`);
      members.forEach(m => console.log(`   - ${m.email} for ${m.course.name}`));
      console.log();
    }

    if (superAdmins.length === 0 && courseAdmins.length === 0 && bookings.length === 0 && members.length === 0) {
      console.log("✅ Email not found anywhere in database");
    }

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

findEmail();
