import "dotenv/config";

console.log("🔍 Email Configuration Diagnostics\n");

const resendKey = process.env.RESEND_API_KEY;
const emailFrom = process.env.EMAIL_FROM;
const appUrl = process.env.NEXT_PUBLIC_APP_URL;

console.log("Environment Variables:");
console.log(`  RESEND_API_KEY: ${resendKey ? `✓ Set (${resendKey.substring(0, 10)}...)` : "❌ NOT SET"}`);
console.log(`  EMAIL_FROM: ${emailFrom || "noreply@linxtimes.com (default)"}`);
console.log(`  APP_URL: ${appUrl || "http://localhost:3000 (default)"}\n`);

if (!resendKey) {
  console.error("❌ RESEND_API_KEY is not configured!");
  console.error("   Without this key, emails cannot be sent via Resend.");
  console.error("   Emails will only be logged to the console in development.\n");
  process.exit(1);
}

// Test Resend connection
async function testResend() {
  console.log("Testing Resend API...\n");

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(resendKey);

    // Try to send a test email
    const result = await resend.emails.send({
      from: emailFrom || "test@resend.dev",
      to: "kyle.tomaselli@gmail.com",
      subject: "LinxTimes Email Test",
      html: `<h1>Test Email</h1><p>If you received this, the email system is working!</p>`,
    });

    if (result.error) {
      console.error("❌ Resend API Error:");
      console.error(result.error);
      process.exit(1);
    }

    console.log("✅ Resend API is working!");
    console.log(`   Email sent successfully`);
    console.log(`   To: kyle.tomaselli@gmail.com`);
    console.log(`   From: ${emailFrom || "noreply@linxtimes.com"}\n`);

  } catch (err) {
    console.error("❌ Error testing Resend:");
    console.error(err);
    process.exit(1);
  }
}

testResend();
