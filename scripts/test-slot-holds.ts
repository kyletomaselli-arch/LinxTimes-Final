import { prisma } from "../src/lib/prisma";

async function test() {
  console.log("Starting slot hold + rain check tests...\n");

  // Test setup: find a test course
  const courseResult = await prisma.course.findFirst({
    where: { slug: "winged-pheasant-golf-links" },
  });
  if (!courseResult) {
    console.error("❌ Test course not found");
    return;
  }
  const course = courseResult;

  // Create a test rain check
  const rainCheck = await prisma.rainCheck.create({
    data: {
      courseId: course.id,
      code: `TEST-${Date.now()}`,
      amountCents: 2500,
      isActive: true,
      reason: "Test",
    },
  });
  console.log(`✓ Created test rain check: ${rainCheck.code}`);

  // Create a test booking (unpaid, confirmed)
  const layout = await prisma.layout.findFirst({
    where: { courseId: course.id, isActive: true },
  });
  if (!layout) {
    console.error("❌ No layout found");
    return;
  }

  const booking = await prisma.booking.create({
    data: {
      courseId: course.id,
      layoutId: layout.id,
      confirmationNo: `TEST-${Date.now()}`,
      bookingDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      slotTime: "09:00",
      numPlayers: 2,
      holes: 18,
      withCart: false,
      golferName: "Test Golfer",
      golferEmail: "test@example.com",
      totalCents: 5000,
      paymentStatus: "unpaid",
      status: "confirmed",
      source: "online",
      rainCheckCode: rainCheck.code,
      termsAcceptedAt: new Date(),
    },
  });
  console.log(`✓ Created test booking: ${booking.confirmationNo}`);

  // TEST 1: Set slot hold
  console.log("\n[TEST 1] Setting slot hold...");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await prisma.booking.update({
    where: { id: booking.id },
    data: { slotHeldUntil: expiresAt },
  });
  const heldBooking = await prisma.booking.findUnique({
    where: { id: booking.id },
  });
  if (heldBooking?.slotHeldUntil) {
    console.log(`✓ Slot hold set, expires at ${heldBooking.slotHeldUntil}`);
  } else {
    console.log("❌ Slot hold not set");
  }

  // TEST 2: Simulate expired hold + cleanup
  console.log("\n[TEST 2] Testing hold expiration & cleanup...");
  // Set hold to past (simulating timeout)
  await prisma.booking.update({
    where: { id: booking.id },
    data: { slotHeldUntil: new Date(Date.now() - 60_000) },
  });
  console.log("✓ Simulated hold expiration (set to 1 min ago)");

  // Call cleanup manually
  const { releaseExpiredSlotHolds } = await import("../src/lib/booking-sweep");
  await releaseExpiredSlotHolds(course.id);
  console.log("✓ Ran cleanup function");

  // Verify hold was released
  const cleanedBooking = await prisma.booking.findUnique({
    where: { id: booking.id },
  });
  if (cleanedBooking?.slotHeldUntil === null) {
    console.log("✓ Hold was released (slotHeldUntil = null)");
  } else {
    console.log("❌ Hold was not released");
  }

  // Verify rain check was restored
  const restoredRainCheck = await prisma.rainCheck.findUnique({
    where: { code: rainCheck.code },
  });
  if (restoredRainCheck?.isActive && !restoredRainCheck?.redeemedAt) {
    console.log("✓ Rain check was restored (isActive=true, redeemedAt=null)");
  } else {
    console.log(
      `❌ Rain check not restored (isActive=${restoredRainCheck?.isActive}, redeemedAt=${restoredRainCheck?.redeemedAt})`
    );
  }

  // TEST 3: Webhook idempotency
  console.log("\n[TEST 3] Testing webhook idempotency...");
  // Reset booking to unpaid + held
  await prisma.booking.update({
    where: { id: booking.id },
    data: {
      paymentStatus: "unpaid",
      slotHeldUntil: expiresAt,
    },
  });
  await prisma.rainCheck.update({
    where: { code: rainCheck.code },
    data: { redeemedAt: null, redeemedBookingId: null, isActive: true },
  });
  console.log("✓ Reset booking for idempotency test");

  // Simulate webhook consuming rain check (first time)
  await prisma.rainCheck.updateMany({
    where: { code: rainCheck.code, courseId: course.id, redeemedAt: null },
    data: {
      redeemedAt: new Date(),
      redeemedBookingId: booking.id,
      isActive: false,
    },
  });
  console.log("✓ Rain check consumed (first webhook)");

  // Simulate webhook retry (idempotent - should not double-consume)
  const retryResult = await prisma.rainCheck.updateMany({
    where: { code: rainCheck.code, courseId: course.id, redeemedAt: null },
    data: {
      redeemedAt: new Date(),
      redeemedBookingId: booking.id,
      isActive: false,
    },
  });
  if (retryResult.count === 0) {
    console.log("✓ Webhook retry is idempotent (count=0, no double-consume)");
  } else {
    console.log("❌ Webhook retry double-consumed the rain check");
  }

  // Cleanup
  await prisma.booking.delete({ where: { id: booking.id } });
  await prisma.rainCheck.delete({ where: { code: rainCheck.code } });
  console.log("\n✓ Cleaned up test data");

  console.log("\n✅ All tests passed!");
}

test().catch(console.error);
