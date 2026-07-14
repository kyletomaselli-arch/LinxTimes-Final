import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
prisma.booking.deleteMany({ where: { confirmationNo: { startsWith: "CAP-" } } })
  .then((r) => console.log("Removed test bookings:", r.count))
  .finally(() => prisma.$disconnect());
