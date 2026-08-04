// Seeds realistic demo bookings for TODAY so the marketing screenshots show a
// busy tee sheet. All rows are tagged notes:"__DEMO__" so _unseed-demo.mjs can
// remove exactly these and nothing else.
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import pkg from './src/generated/prisma/index.js';
const { PrismaClient } = pkg;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const SLUG = 'winged-pheasant-golf-links';
const TAG = '__DEMO__';

// Upcoming times today, so they render in the tee sheet's default (non-past) view.
const groups = [
  { time: '15:40', name: 'Marcus Bell',      players: 4, cart: true,  paid: 'paid_online' },
  { time: '15:50', name: 'Dana Whitfield',   players: 2, cart: false, paid: 'paid_online' },
  { time: '16:00', name: 'Ray Okafor',       players: 3, cart: true,  paid: 'paid_online' },
  { time: '16:10', name: 'Chris Lindqvist',  players: 4, cart: true,  paid: 'pay_at_course' },
  { time: '16:20', name: 'Priya Raman',      players: 2, cart: false, paid: 'paid_online' },
  { time: '16:30', name: 'Tom Alvarez',      players: 4, cart: true,  paid: 'paid_online' },
  { time: '16:40', name: 'Jordan Pike',      players: 3, cart: false, paid: 'pay_at_course' },
  { time: '16:50', name: 'Sam Whitaker',     players: 4, cart: true,  paid: 'paid_online' },
  { time: '17:00', name: 'Nina Castellanos', players: 2, cart: true,  paid: 'paid_online' },
  { time: '17:10', name: 'Wes Harlow',       players: 4, cart: false, paid: 'paid_online' },
];

// Tomorrow morning — makes the public tee-time grid show real demand
// (Full / partially-booked slots) instead of a uniform wall of openings.
const tomorrowGroups = [
  { time: '07:00', name: 'Beau Ellison',   players: 4, cart: true,  paid: 'paid_online' },
  { time: '07:10', name: 'Hana Sørensen',  players: 4, cart: true,  paid: 'paid_online' },
  { time: '07:20', name: 'Miles Okonkwo',  players: 2, cart: false, paid: 'paid_online' },
  { time: '07:40', name: 'Gina Petrarca',  players: 4, cart: true,  paid: 'paid_online' },
  { time: '08:00', name: 'Curtis Vaughn',  players: 3, cart: true,  paid: 'paid_online' },
  { time: '08:20', name: 'Amara Diallo',   players: 4, cart: false, paid: 'paid_online' },
  { time: '09:00', name: 'Peter Lindgren', players: 2, cart: true,  paid: 'paid_online' },
];

const course = await prisma.course.findUnique({ where: { slug: SLUG } });
const layout = await prisma.layout.findFirst({ where: { courseId: course.id, isActive: true }, include: { pricing: true } });

// Today at UTC midnight, matching how bookingDate is stored.
const now = new Date();
const bookingDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
const dateKey = bookingDate.toISOString().slice(0, 10);
const tomorrowDate = new Date(bookingDate.getTime() + 86400000);
const tomorrowKey = tomorrowDate.toISOString().slice(0, 10);

let made = 0;
for (const [i, g] of groups.entries()) {
  const green = layout.pricing.weekendFee * g.players; // today is Saturday
  const cart = g.cart ? layout.pricing.cartFee * g.players : 0;
  const fee = course.linxtimesFee * g.players;
  const tax = Math.round(((green + cart) * course.taxRateBps) / 10000);
  const total = green + cart + fee + tax;

  await prisma.booking.create({
    data: {
      confirmationNo: `DEMO-${dateKey.replace(/-/g, '')}-${String(i + 1).padStart(4, '0')}`,
      courseId: course.id,
      layoutId: layout.id,
      bookingDate,
      slotTime: g.time,
      numPlayers: g.players,
      withCart: g.cart,
      holes: 18,
      golferName: g.name,
      golferEmail: `${g.name.split(' ')[0].toLowerCase()}@example.com`,
      rateType: 'weekend',
      greenFeeCents: green,
      cartFeeCents: cart,
      bookingFeeCents: fee,
      taxCents: tax,
      memberCount: 0,
      discountCents: 0,
      creditCents: 0,
      totalCents: total,
      amountPaidCents: g.paid === 'paid_online' ? total : 0,
      notes: TAG,
      termsAcceptedAt: new Date(),
      paymentStatus: g.paid,
      status: 'confirmed',
      source: g.paid === 'pay_at_course' ? 'walkin' : 'online',
    },
  });
  made++;
}

for (const [i, g] of tomorrowGroups.entries()) {
  const green = layout.pricing.weekendFee * g.players;
  const cart = g.cart ? layout.pricing.cartFee * g.players : 0;
  const fee = course.linxtimesFee * g.players;
  const tax = Math.round(((green + cart) * course.taxRateBps) / 10000);
  const total = green + cart + fee + tax;

  await prisma.booking.create({
    data: {
      confirmationNo: `DEMO-${tomorrowKey.replace(/-/g, '')}-${String(i + 1).padStart(4, '0')}`,
      courseId: course.id,
      layoutId: layout.id,
      bookingDate: tomorrowDate,
      slotTime: g.time,
      numPlayers: g.players,
      withCart: g.cart,
      holes: 18,
      golferName: g.name,
      golferEmail: `${g.name.split(' ')[0].toLowerCase()}@example.com`,
      rateType: 'weekend',
      greenFeeCents: green,
      cartFeeCents: cart,
      bookingFeeCents: fee,
      taxCents: tax,
      memberCount: 0,
      discountCents: 0,
      creditCents: 0,
      totalCents: total,
      amountPaidCents: total,
      notes: TAG,
      termsAcceptedAt: new Date(),
      paymentStatus: g.paid,
      status: 'confirmed',
      source: 'online',
    },
  });
  made++;
}

console.log(`seeded ${made} demo bookings (${dateKey} + ${tomorrowKey})`);
await prisma.$disconnect();
