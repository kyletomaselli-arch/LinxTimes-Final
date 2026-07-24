#!/usr/bin/env node
require('dotenv').config();

const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");
const pg = require("pg");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("❌ DATABASE_URL not set");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

(async () => {
  try {
    console.log("Creating test course...");
    const slug = `test-golf-course-${Date.now()}`;

    const course = await prisma.course.create({
      data: {
        name: "Test Golf Course",
        slug,
        status: "active",
        timezone: "America/Chicago",
        stripeAccountId: "acct_1TwYekDc2sDjdBxe",
        stripeOnboarded: true,
        greenFeeCents: 5000,
        cartFeeCents: 1500,
        linxtimesInPersonFeeCents: 50,
        taxRateBps: 825,
        cancellationFeeBps: 0,
        inPersonFeePerPlayer: 50,
      },
    });

    console.log("\n✅ Test course created!");
    console.log("Course ID:", course.id);
    console.log("Slug:", course.slug);
    console.log("Stripe Account:", course.stripeAccountId);
    console.log("\n👉 Public booking page: https://linx-times-final.vercel.app/" + slug);

  } catch (err) {
    console.error("❌ Error:", err.message);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
})();
