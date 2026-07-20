import { prisma } from "./src/lib/prisma";

async function setupTestData() {
  console.log("Clearing existing bookings and payments...");
  await prisma.payment.deleteMany({});
  await prisma.booking.deleteMany({});

  const course = await prisma.course.findFirst();
  if (!course) {
    console.error("No course found");
    process.exit(1);
  }

  let layout = await prisma.layout.findFirst({ where: { courseId: course.id } });
  if (!layout) {
    layout = await prisma.layout.create({
      data: { courseId: course.id, name: "Test Layout", holes: 18 },
    });
  }

  console.log(`Using course: ${course.name}, layout: ${layout.name}`);

  const testDate = new Date();
  testDate.setDate(testDate.getDate() + 1);

  // Online booking 1: 2 non-members = $2 fee
  const b1 = await prisma.booking.create({
    data: {
      confirmationNo: "TEST001",
      courseId: course.id,
      layoutId: layout.id,
      bookingDate: testDate,
      slotTime: "09:00",
      numPlayers: 2,
      memberCount: 0,
      golferName: "Test 1",
      golferEmail: "test1@ex.com",
      greenFeeCents: 4000,
      totalCents: 5000,
      bookingFeeCents: 0,
      paymentStatus: "paid_online",
      status: "confirmed",
    },
  });

  // Online booking 2: 1 member + 1 non-member = $1 fee
  const b2 = await prisma.booking.create({
    data: {
      confirmationNo: "TEST002",
      courseId: course.id,
      layoutId: layout.id,
      bookingDate: testDate,
      slotTime: "09:30",
      numPlayers: 2,
      memberCount: 1,
      golferName: "Test 2",
      golferEmail: "test2@ex.com",
      greenFeeCents: 4000,
      totalCents: 5000,
      bookingFeeCents: 0,
      paymentStatus: "paid_online",
      status: "confirmed",
    },
  });

  // In-person booking 1: 2 non-members = $1 fee
  const b3 = await prisma.booking.create({
    data: {
      confirmationNo: "TEST003",
      courseId: course.id,
      layoutId: layout.id,
      bookingDate: testDate,
      slotTime: "10:00",
      numPlayers: 2,
      memberCount: 0,
      golferName: "Test 3",
      golferEmail: "test3@ex.com",
      greenFeeCents: 4000,
      totalCents: 5000,
      bookingFeeCents: 0,
      paymentStatus: "paid_in_person",
      status: "confirmed",
    },
  });

  // In-person booking 2: 1 member + 1 non-member = $0.50 fee
  const b4 = await prisma.booking.create({
    data: {
      confirmationNo: "TEST004",
      courseId: course.id,
      layoutId: layout.id,
      bookingDate: testDate,
      slotTime: "10:30",
      numPlayers: 2,
      memberCount: 1,
      golferName: "Test 4",
      golferEmail: "test4@ex.com",
      greenFeeCents: 4000,
      totalCents: 5000,
      bookingFeeCents: 0,
      paymentStatus: "paid_in_person",
      status: "confirmed",
    },
  });

  // Cancelled booking: 2 non-members = $2 retained
  const b5 = await prisma.booking.create({
    data: {
      confirmationNo: "TEST005",
      courseId: course.id,
      layoutId: layout.id,
      bookingDate: testDate,
      slotTime: "11:00",
      numPlayers: 2,
      memberCount: 0,
      golferName: "Test 5",
      golferEmail: "test5@ex.com",
      greenFeeCents: 4000,
      totalCents: 5000,
      bookingFeeCents: 0,
      paymentStatus: "paid_online",
      status: "cancelled",
    },
  });

  // Create payments
  await prisma.payment.create({
    data: {
      bookingId: b1.id,
      courseId: course.id,
      amountCents: 5000,
      feeCents: 200, // 2 non-members × $1
      method: "terminal",
      state: "succeeded",
    },
  });

  await prisma.payment.create({
    data: {
      bookingId: b2.id,
      courseId: course.id,
      amountCents: 5000,
      feeCents: 100, // 1 non-member × $1
      method: "terminal",
      state: "succeeded",
    },
  });

  await prisma.payment.create({
    data: {
      bookingId: b3.id,
      courseId: course.id,
      amountCents: 5000,
      feeCents: 100, // 2 non-members × $0.50
      method: "terminal",
      state: "succeeded",
    },
  });

  await prisma.payment.create({
    data: {
      bookingId: b4.id,
      courseId: course.id,
      amountCents: 5000,
      feeCents: 50, // 1 non-member × $0.50
      method: "terminal",
      state: "succeeded",
    },
  });

  await prisma.payment.create({
    data: {
      bookingId: b5.id,
      courseId: course.id,
      amountCents: 5000,
      feeCents: 200, // 2 non-members × $1 (retained from cancelled)
      method: "terminal",
      state: "succeeded",
    },
  });

  // Pro-shop test: add another payment with add-ons to b3
  await prisma.payment.create({
    data: {
      bookingId: b3.id,
      courseId: course.id,
      amountCents: 2000,
      feeCents: 100, // $0.50 base + $0.50 pro-shop = $100 cents
      addonsCents: 1500,
      addonSummary: "2× Golf balls",
      method: "terminal",
      state: "succeeded",
    },
  });

  console.log("\n✓ Test data created!");
  console.log("\nExpected stats:");
  console.log("  Online bookings: 2");
  console.log("  In-person bookings: 2");
  console.log("  Cancelled bookings: 1");
  console.log("  Active booking fees: $5.00 (online $3 + in-person $1.50 + proshop $0.50)");
  console.log("  Cancelled booking fees retained: $2.00");
  console.log("  Total earned: $7.00");

  process.exit(0);
}

setupTestData().catch(console.error);
