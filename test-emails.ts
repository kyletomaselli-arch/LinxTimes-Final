import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./src/generated/prisma";
import { sendPasswordResetEmail, sendBookingEmails, sendCancellationEmail } from "./src/lib/email";
import { buildConfirmationNo } from "./src/lib/confirmation";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function testEmails() {
  console.log("🧪 Testing LinxTimes Email System\n");

  try {
    // Get test course and admin
    const course = await prisma.course.findUnique({
      where: { slug: "winged-pheasant-golf-links" },
    });
    const admin = await prisma.courseAdmin.findUnique({
      where: { email: "pro@wingedpheasant.example.com" },
    });

    if (!course || !admin) {
      console.error("❌ Test data not found. Run: npm run db:seed");
      process.exit(1);
    }

    console.log(`✓ Found test course: ${course.name}`);
    console.log(`✓ Found test admin: ${admin.email}\n`);

    // TEST 1: Password Reset Email
    console.log("📧 TEST 1: Password Reset Email");
    const resetUrl = "http://localhost:3000/dashboard/reset?token=test-token-12345";
    await sendPasswordResetEmail(
      "kyle.tomaselli@gmail.com",
      admin.name,
      resetUrl
    );
    console.log("✓ Password reset email sent to kyle.tomaselli@gmail.com\n");

    // TEST 2: Booking Confirmation Email (Phone Booking)
    console.log("📧 TEST 2: Phone Booking Confirmation Email");
    const layout = await prisma.layout.findFirst({
      where: { courseId: course.id },
    });

    if (!layout) {
      console.error("❌ No layout found for course");
      process.exit(1);
    }

    const phoneBooking = await prisma.booking.create({
      data: {
        confirmationNo: buildConfirmationNo(),
        courseId: course.id,
        layoutId: layout.id,
        bookingDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        slotTime: "10:00",
        numPlayers: 4,
        holes: 18,
        golferName: "Test Golfer Phone",
        golferEmail: "kyle.tomaselli@gmail.com",
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

    await sendBookingEmails(phoneBooking.id);
    console.log(`✓ Phone booking confirmation sent (Conf: ${phoneBooking.confirmationNo})\n`);

    // TEST 3: Booking Confirmation Email (Online/Paid Booking)
    console.log("📧 TEST 3: Online Payment Confirmation Email");
    const onlineBooking = await prisma.booking.create({
      data: {
        confirmationNo: buildConfirmationNo(),
        courseId: course.id,
        layoutId: layout.id,
        bookingDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
        slotTime: "14:00",
        numPlayers: 2,
        holes: 18,
        golferName: "Test Golfer Online",
        golferEmail: "kyle.tomaselli@gmail.com",
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

    await sendBookingEmails(onlineBooking.id);
    console.log(`✓ Online payment confirmation sent (Conf: ${onlineBooking.confirmationNo})\n`);

    // TEST 4: Cancellation Email
    console.log("📧 TEST 4: Cancellation Email");
    const bookingToCancel = await prisma.booking.create({
      data: {
        confirmationNo: buildConfirmationNo(),
        courseId: course.id,
        layoutId: layout.id,
        bookingDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
        slotTime: "09:00",
        numPlayers: 3,
        holes: 18,
        golferName: "Test Golfer Cancellation",
        golferEmail: "kyle.tomaselli@gmail.com",
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

    // Simulate cancellation
    await prisma.booking.update({
      where: { id: bookingToCancel.id },
      data: {
        status: "cancelled",
        cancelledAt: new Date(),
        cancelledBy: admin.id,
        cancellationReason: "Test cancellation",
      },
    });

    const refundedCents = 6600 - Math.round((6600 * (course.cancellationFeeBps ?? 0)) / 10000);
    await sendCancellationEmail(bookingToCancel.id, refundedCents);
    console.log(`✓ Cancellation email sent (Conf: ${bookingToCancel.confirmationNo})\n`);

    console.log("✅ All email tests completed!");
    console.log("\n📬 Check your email inbox at kyle.tomaselli@gmail.com");
    console.log("   You should receive 4 emails:");
    console.log("   1. Password reset link");
    console.log("   2. Phone booking confirmation");
    console.log("   3. Online payment confirmation");
    console.log("   4. Cancellation notice\n");

  } catch (err) {
    console.error("❌ Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

testEmails();
