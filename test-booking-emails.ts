import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./src/generated/prisma";
import { buildConfirmationNo } from "./src/lib/confirmation";
import { toDateKey } from "./src/lib/datetime";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function testBookingEmails() {
  console.log("📧 Creating test bookings to trigger emails...\n");

  try {
    // Get the Winged Pheasant course
    const course = await prisma.course.findUnique({
      where: { slug: "winged-pheasant-golf-links" },
    });

    if (!course) {
      console.error("❌ Winged Pheasant course not found");
      process.exit(1);
    }

    const layout = await prisma.layout.findFirst({
      where: { courseId: course.id },
    });

    if (!layout) {
      console.error("❌ No layout found");
      process.exit(1);
    }

    const userEmail = "kyle.tomaselli@gmail.com";

    // Create test booking 1: Phone booking (unpaid) - will get confirmation email
    console.log("1️⃣  Creating phone booking...");
    const date1 = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    const phoneBooking = await prisma.booking.create({
      data: {
        confirmationNo: buildConfirmationNo(course.slug, toDateKey(date1), 1),
        courseId: course.id,
        layoutId: layout.id,
        bookingDate: date1,
        slotTime: "10:00",
        numPlayers: 4,
        holes: 18,
        golferName: "Test Player (Phone)",
        golferEmail: userEmail,
        golferPhone: "615-555-0123",
        rateType: "weekday",
        greenFeeCents: 5000,
        cartFeeCents: 1500,
        bookingFeeCents: 100,
        totalCents: 6600,
        paymentStatus: "unpaid",
        source: "phone",
        status: "confirmed",
      },
    });
    console.log(`   ✓ Created: ${phoneBooking.confirmationNo}`);
    console.log(`   → You'll receive: Booking confirmation email\n`);

    // Create test booking 2: Paid booking - will get confirmation email
    console.log("2️⃣  Creating paid online booking...");
    const date2 = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const paidBooking = await prisma.booking.create({
      data: {
        confirmationNo: buildConfirmationNo(course.slug, toDateKey(date2), 2),
        courseId: course.id,
        layoutId: layout.id,
        bookingDate: date2,
        slotTime: "14:00",
        numPlayers: 2,
        holes: 18,
        golferName: "Test Player (Paid)",
        golferEmail: userEmail,
        golferPhone: "615-555-0456",
        rateType: "weekday",
        greenFeeCents: 5000,
        cartFeeCents: 0,
        bookingFeeCents: 100,
        totalCents: 5100,
        paymentStatus: "paid_online",
        amountPaidCents: 5100,
        source: "online",
        status: "confirmed",
      },
    });
    console.log(`   ✓ Created: ${paidBooking.confirmationNo}`);
    console.log(`   → You'll receive: Paid booking confirmation email\n`);

    // Create test booking 3: To be cancelled - will trigger cancellation email
    console.log("3️⃣  Creating booking to cancel...");
    const date3 = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const cancelBooking = await prisma.booking.create({
      data: {
        confirmationNo: buildConfirmationNo(course.slug, toDateKey(date3), 3),
        courseId: course.id,
        layoutId: layout.id,
        bookingDate: date3,
        slotTime: "09:00",
        numPlayers: 3,
        holes: 18,
        golferName: "Test Player (Cancel)",
        golferEmail: userEmail,
        golferPhone: "615-555-0789",
        rateType: "weekday",
        greenFeeCents: 5000,
        cartFeeCents: 1500,
        bookingFeeCents: 100,
        totalCents: 6600,
        paymentStatus: "paid_online",
        amountPaidCents: 6600,
        source: "online",
        status: "confirmed",
      },
    });
    console.log(`   ✓ Created: ${cancelBooking.confirmationNo}`);

    // Get admin for cancellation
    const admin = await prisma.courseAdmin.findFirst({
      where: { courseId: course.id },
    });

    // Now cancel it
    await prisma.booking.update({
      where: { id: cancelBooking.id },
      data: {
        status: "cancelled",
        cancelledAt: new Date(),
        cancelledBy: admin?.id,
        cancellationReason: "Test cancellation",
      },
    });
    console.log(`   ✓ Cancelled: ${cancelBooking.confirmationNo}`);
    console.log(`   → You'll receive: Cancellation email with refund amount\n`);

    console.log("✅ All test bookings created!\n");
    console.log("📬 Check your inbox at kyle.tomaselli@gmail.com for:");
    console.log("   1. Phone booking confirmation");
    console.log("   2. Paid booking confirmation");
    console.log("   3. Cancellation notice with refund\n");

  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testBookingEmails();
