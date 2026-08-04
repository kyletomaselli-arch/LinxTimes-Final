// Removes exactly the demo bookings created by _seed-demo.mjs (notes = "__DEMO__").
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import pkg from './src/generated/prisma/index.js';
const { PrismaClient } = pkg;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const ids = (await prisma.booking.findMany({ where: { notes: '__DEMO__' }, select: { id: true } })).map(b => b.id);
const pay = await prisma.payment.deleteMany({ where: { bookingId: { in: ids } } });
const del = await prisma.booking.deleteMany({ where: { id: { in: ids } } });
console.log(`removed ${del.count} demo bookings, ${pay.count} payments`);
await prisma.$disconnect();
