import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma";
import * as bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Super admin
  const superAdminHash = await bcrypt.hash("admin1234!", 12);
  const superAdmin = await prisma.superAdmin.upsert({
    where: { email: "admin@linxtimes.com" },
    update: {},
    create: {
      email: "admin@linxtimes.com",
      passwordHash: superAdminHash,
      name: "LinxTimes Admin",
    },
  });
  console.log("Super admin:", superAdmin.email);

  // Demo course — Winged Pheasant Golf Links
  const course = await prisma.course.upsert({
    where: { slug: "winged-pheasant-golf-links" },
    update: {},
    create: {
      slug: "winged-pheasant-golf-links",
      name: "Winged Pheasant Golf Links",
      address: "1234 Fairway Drive",
      city: "Nashville",
      state: "TN",
      zip: "37201",
      phone: "615-555-0100",
      website: "https://wingedpheasant.example.com",
      email: "pro@wingedpheasant.example.com",
      primaryColor: "#1a5c38",
      secondaryColor: "#c9a84c",
      latitude: 36.1627,
      longitude: -86.7816,
      timezone: "America/Chicago",
      status: "active",
      linxtimesFee: 100,
      notificationEmail: "pro@wingedpheasant.example.com",
      payAtCourseEnabled: false,
      maxDaysAhead: 14,
      bookingIntervalMin: 10,
      onboardedAt: new Date(),
    },
  });
  console.log("Demo course:", course.name);

  // Course admin
  const adminHash = await bcrypt.hash("course1234!", 12);
  await prisma.courseAdmin.upsert({
    where: { email: "pro@wingedpheasant.example.com" },
    update: {},
    create: {
      courseId: course.id,
      email: "pro@wingedpheasant.example.com",
      passwordHash: adminHash,
      name: "Head Pro",
    },
  });

  // Layout: The Liberator (18 holes)
  const liberator = await prisma.layout.upsert({
    where: { id: "liberator-layout-seed-id" },
    update: {},
    create: {
      id: "liberator-layout-seed-id",
      courseId: course.id,
      name: "The Liberator",
      holes: 18,
      isActive: true,
    },
  });

  // Pricing for The Liberator
  await prisma.pricing.upsert({
    where: { layoutId: liberator.id },
    update: {},
    create: {
      layoutId: liberator.id,
      weekdayFee: 5500,
      weekendFee: 7500,
      twilightFee: 3500,
      twilightHour: 16,
      memberFee: 2500,
      cartFee: 1800,
      cartAvailable: true,
    },
  });

  // Tee time slots — Mon through Sun, 7am–6pm every 10 min
  for (let day = 0; day <= 6; day++) {
    await prisma.teeTimeSlot.upsert({
      where: { layoutId_dayOfWeek: { layoutId: liberator.id, dayOfWeek: day } },
      update: {},
      create: {
        layoutId: liberator.id,
        dayOfWeek: day,
        startTime: "07:00",
        endTime: "18:00",
        intervalMin: 10,
        maxPlayers: 4,
        isActive: true,
      },
    });
  }

  // Layout: The Rock (9 holes)
  const rock = await prisma.layout.upsert({
    where: { id: "rock-layout-seed-id" },
    update: {},
    create: {
      id: "rock-layout-seed-id",
      courseId: course.id,
      name: "The Rock",
      holes: 9,
      isActive: true,
    },
  });

  await prisma.pricing.upsert({
    where: { layoutId: rock.id },
    update: {},
    create: {
      layoutId: rock.id,
      weekdayFee: 3000,
      weekendFee: 4000,
      twilightFee: 2000,
      twilightHour: 16,
      memberFee: 1500,
      cartFee: 1000,
      cartAvailable: true,
    },
  });

  for (let day = 0; day <= 6; day++) {
    await prisma.teeTimeSlot.upsert({
      where: { layoutId_dayOfWeek: { layoutId: rock.id, dayOfWeek: day } },
      update: {},
      create: {
        layoutId: rock.id,
        dayOfWeek: day,
        startTime: "07:00",
        endTime: "18:00",
        intervalMin: 10,
        maxPlayers: 4,
        isActive: true,
      },
    });
  }

  // Sample member
  await prisma.member.upsert({
    where: { courseId_memberId: { courseId: course.id, memberId: "WP-001" } },
    update: {},
    create: {
      courseId: course.id,
      memberId: "WP-001",
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      phone: "615-555-0199",
      membershipType: "full",
      cartIncluded: true,
      discountDays: "all",
      isActive: true,
    },
  });

  // Whitelisted course (Path A) — approved, no admin yet, awaiting onboarding.
  await prisma.course.upsert({
    where: { slug: "pine-valley-preview" },
    update: {},
    create: {
      slug: "pine-valley-preview",
      name: "Pine Valley Preview",
      email: "owner@pinevalley.example.com",
      city: "Rochester",
      state: "NY",
      status: "approved",
      timezone: "America/New_York",
    },
  });
  console.log("Whitelisted course: owner@pinevalley.example.com → /onboard");

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
