import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma";
import { golferConfirmationEmail, adminNotificationEmail } from "../src/lib/email-templates";
import { toDateKey } from "../src/lib/datetime";
import { writeFileSync } from "node:fs";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const confirmationNo = process.argv[2] ?? "WINGED-PHEASANT-GOLF-LINKS-20260705-0001";
  const booking = await prisma.booking.findUnique({
    where: { confirmationNo },
    include: { course: true, layout: true },
  });
  if (!booking) {
    console.error("Booking not found:", confirmationNo);
    process.exit(1);
  }
  const c = booking.course;
  const data = {
    courseName: c.name,
    courseCity: c.city,
    courseState: c.state,
    coursePhone: c.phone,
    primaryColor: c.primaryColor || "#0d3522",
    confirmationNo: booking.confirmationNo,
    layoutName: booking.layout.name,
    dateKey: toDateKey(booking.bookingDate),
    slotTime: booking.slotTime,
    numPlayers: booking.numPlayers,
    holes: booking.holes,
    withCart: booking.withCart,
    golferName: booking.golferName,
    golferEmail: booking.golferEmail,
    golferPhone: booking.golferPhone,
    totalCents: booking.totalCents,
    paymentStatus: booking.paymentStatus,
    source: booking.source,
    confirmUrl: `http://localhost:3000/${c.slug}/confirm/${booking.confirmationNo}`,
  };

  const golfer = golferConfirmationEmail(data);
  const admin = adminNotificationEmail(data);

  writeFileSync("public/email-golfer.html", golfer.html);
  writeFileSync("public/email-admin.html", admin.html);

  console.log("Golfer subject:", golfer.subject);
  console.log("Admin subject: ", admin.subject);
  console.log("Wrote public/email-golfer.html and public/email-admin.html");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
