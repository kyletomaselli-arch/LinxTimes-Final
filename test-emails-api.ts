import "dotenv/config";
import { Resend } from "resend";
import { golferConfirmationEmail, adminNotificationEmail, passwordResetEmail as pwResetTemplate, cancellationEmail } from "./src/lib/email-templates";
import { toDateKey } from "./src/lib/datetime";
import { formatCentsCompact } from "./src/lib/money";

const resend = new Resend(process.env.RESEND_API_KEY);
const EMAIL_FROM = process.env.EMAIL_FROM || "LinxTimes <noreply@linxtimes.com>";
const userEmail = "kyle.tomaselli@gmail.com";

async function testEmails() {
  console.log("🧪 Testing LinxTimes Email System\n");

  try {
    // TEST 1: Password Reset Email
    console.log("📧 TEST 1: Password Reset Email");
    const resetUrl = "http://localhost:3000/dashboard/reset?token=test-token-12345";
    const pwReset = pwResetTemplate("Test Admin", resetUrl);

    await resend.emails.send({
      from: EMAIL_FROM,
      to: userEmail,
      subject: pwReset.subject,
      html: pwReset.html,
    });
    console.log("✓ Password reset email sent\n");

    // TEST 2: Phone Booking Confirmation
    console.log("📧 TEST 2: Phone Booking Confirmation Email");
    const bookingData1 = {
      courseName: "Winged Pheasant Golf Links",
      courseCity: "Nashville",
      courseState: "TN",
      coursePhone: "615-555-0100",
      primaryColor: "#1a5c38",
      confirmationNo: "PHONE-TEST-001",
      layoutName: "The Liberator",
      dateKey: toDateKey(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
      slotTime: "10:00",
      numPlayers: 4,
      holes: 18,
      withCart: true,
      golferName: "Test Golfer (Phone)",
      golferEmail: userEmail,
      golferPhone: "615-555-0123",
      totalCents: 6600,
      paymentStatus: "unpaid",
      source: "phone",
      confirmUrl: "http://localhost:3000/winged-pheasant-golf-links/confirm/PHONE-TEST-001",
    };

    const confirmation1 = golferConfirmationEmail(bookingData1);
    await resend.emails.send({
      from: EMAIL_FROM,
      to: userEmail,
      subject: confirmation1.subject,
      html: confirmation1.html,
      replyTo: "pro@wingedpheasant.example.com",
    });
    console.log("✓ Phone booking confirmation sent\n");

    // TEST 3: Online Payment Confirmation
    console.log("📧 TEST 3: Online Payment Confirmation Email");
    const bookingData2 = {
      courseName: "Winged Pheasant Golf Links",
      courseCity: "Nashville",
      courseState: "TN",
      coursePhone: "615-555-0100",
      primaryColor: "#1a5c38",
      confirmationNo: "ONLINE-TEST-002",
      layoutName: "The Liberator",
      dateKey: toDateKey(new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)),
      slotTime: "14:00",
      numPlayers: 2,
      holes: 18,
      withCart: false,
      golferName: "Test Golfer (Online)",
      golferEmail: userEmail,
      golferPhone: "615-555-0456",
      totalCents: 5100,
      paymentStatus: "paid_online",
      source: "online",
      confirmUrl: "http://localhost:3000/winged-pheasant-golf-links/confirm/ONLINE-TEST-002",
    };

    const confirmation2 = golferConfirmationEmail(bookingData2);
    await resend.emails.send({
      from: EMAIL_FROM,
      to: userEmail,
      subject: confirmation2.subject,
      html: confirmation2.html,
      replyTo: "pro@wingedpheasant.example.com",
    });
    console.log("✓ Online payment confirmation sent\n");

    // TEST 4: Cancellation Email
    console.log("📧 TEST 4: Cancellation Email");
    const bookingData3 = {
      courseName: "Winged Pheasant Golf Links",
      courseCity: "Nashville",
      courseState: "TN",
      coursePhone: "615-555-0100",
      primaryColor: "#1a5c38",
      confirmationNo: "CANCEL-TEST-003",
      layoutName: "The Liberator",
      dateKey: toDateKey(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)),
      slotTime: "09:00",
      numPlayers: 3,
      holes: 18,
      withCart: true,
      golferName: "Test Golfer (Cancelled)",
      golferEmail: userEmail,
      golferPhone: "615-555-0789",
      totalCents: 6600,
      paymentStatus: "refunded",
      source: "online",
      confirmUrl: "http://localhost:3000/winged-pheasant-golf-links/confirm/CANCEL-TEST-003",
    };

    const cancelEmail = cancellationEmail(bookingData3, 6200); // $62 refunded (non-refundable fee)
    await resend.emails.send({
      from: EMAIL_FROM,
      to: userEmail,
      subject: cancelEmail.subject,
      html: cancelEmail.html,
      replyTo: "pro@wingedpheasant.example.com",
    });
    console.log("✓ Cancellation email sent\n");

    console.log("✅ All email tests completed successfully!\n");
    console.log("📬 You should receive 4 emails at kyle.tomaselli@gmail.com:");
    console.log("   1. ✓ Password reset link");
    console.log("   2. ✓ Phone booking confirmation");
    console.log("   3. ✓ Online payment confirmation");
    console.log("   4. ✓ Cancellation notice\n");

  } catch (err) {
    console.error("❌ Error sending emails:", err);
    process.exit(1);
  }
}

testEmails();
