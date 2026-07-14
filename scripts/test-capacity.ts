import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const DATE = "2026-07-15";
async function mk(course: string, layout: string, time: string, name: string, players: number, seq: number) {
  return prisma.booking.create({ data: {
    confirmationNo: `CAP-${DATE.replace(/-/g,"")}-${time.replace(":","")}-${seq}`,
    courseId: course, layoutId: layout, bookingDate: new Date(DATE+"T00:00:00Z"), slotTime: time,
    numPlayers: players, holes: 18, golferName: name, golferEmail: "x@example.com",
    rateType: "weekday", greenFeeCents: 5500*players, cartFeeCents: 0, bookingFeeCents: 0,
    totalCents: 5500*players, paymentStatus: "pay_at_course", status: "confirmed", source: "walkin",
  }});
}
async function main() {
  const c = await prisma.course.findUnique({ where: { slug: "winged-pheasant-golf-links" } });
  const layout = "liberator-layout-seed-id";
  await prisma.booking.deleteMany({ where: { courseId: c!.id, bookingDate: new Date(DATE+"T00:00:00Z") } });
  await mk(c!.id, layout, "09:00", "Alpha Group", 2, 1);
  await mk(c!.id, layout, "09:00", "Bravo Group", 2, 2);   // 09:00 now 4/4 = full
  await mk(c!.id, layout, "09:10", "Charlie Group", 2, 3); // 09:10 now 2/4
  console.log("Inserted: 09:00 => 2 groups (4 players), 09:10 => 1 group (2 players)");
}
main().finally(() => prisma.$disconnect());
