import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const DATE = "2026-07-16";
async function main() {
  const c = await prisma.course.findUnique({ where: { slug: "winged-pheasant-golf-links" } });
  await prisma.booking.deleteMany({ where: { confirmationNo: { startsWith: "COLLECT-" } } });
  await prisma.booking.create({ data: {
    confirmationNo: "COLLECT-TEST-1", courseId: c!.id, layoutId: "liberator-layout-seed-id",
    bookingDate: new Date(DATE+"T00:00:00Z"), slotTime: "10:00", numPlayers: 2, holes: 18,
    golferName: "Cash Payer", golferEmail: "x@example.com", rateType: "weekday",
    greenFeeCents: 11000, cartFeeCents: 0, bookingFeeCents: 0, totalCents: 11000,
    paymentStatus: "unpaid", amountPaidCents: 0, status: "confirmed", source: "walkin",
  }});
  console.log("Created unpaid walk-in COLLECT-TEST-1 on", DATE);
}
main().finally(() => prisma.$disconnect());
