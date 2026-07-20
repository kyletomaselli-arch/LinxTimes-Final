import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma";

/**
 * One-shot migration: backfill LinxTimes fees on historical bookings that were
 * recorded before fee tracking existed. Moved out of /api/admin/backfill-fees
 * so a destructive data migration is never routable. Run manually:
 *
 *   npx tsx scripts/backfill-fees.ts
 */
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const courses = await prisma.course.findMany();
  let backfilled = 0;

  for (const course of courses) {
    const bookings = await prisma.booking.findMany({
      where: {
        courseId: course.id,
        paymentStatus: { in: ["paid_online", "refunded", "paid_in_person", "partially_paid"] },
      },
    });

    for (const booking of bookings) {
      if (
        ["paid_in_person", "partially_paid"].includes(booking.paymentStatus) &&
        booking.inPersonFeesCents === 0
      ) {
        await prisma.booking.update({
          where: { id: booking.id },
          data: { inPersonFeesCents: course.linxtimesInPersonFee * booking.numPlayers },
        });
        backfilled++;
      }

      if (
        ["paid_online", "refunded"].includes(booking.paymentStatus) &&
        booking.bookingFeeCents === 0
      ) {
        await prisma.booking.update({
          where: { id: booking.id },
          data: { bookingFeeCents: course.linxtimesFee * booking.numPlayers },
        });
        backfilled++;
      }
    }
    console.log(`${course.name}: processed ${bookings.length} bookings`);
  }
  console.log(`Backfilled fees on ${backfilled} bookings.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
