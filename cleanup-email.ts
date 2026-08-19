import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./src/generated/prisma";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function cleanup() {
  const email = "kyle.tomaselli@gmail.com";
  console.log(`🧹 Cleaning up ${email}...\n`);

  try {
    // Delete test bookings with this email
    const bookingsDeleted = await prisma.booking.deleteMany({
      where: { golferEmail: email },
    });
    console.log(`✓ Deleted ${bookingsDeleted.count} test bookings`);

    // Delete the CourseAdmin record
    const adminsDeleted = await prisma.courseAdmin.deleteMany({
      where: { email },
    });
    console.log(`✓ Deleted ${adminsDeleted.count} CourseAdmin account(s)`);

    console.log(`\n✅ Cleanup complete! You can now create a staff account with ${email}\n`);

  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

cleanup();
