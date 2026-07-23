import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./src/generated/prisma/index.js";
import "dotenv/config";

const BASE = process.env.STRESS_BASE ?? "http://localhost:3000";
const SLUG = "winged-pheasant-golf-links";
const LAYOUT = "liberator-layout-seed-id";
const MARKER = "@stresstest.local"; // every test golfer email ends with this
const MAX_PER_SLOT = 4;

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// A date a few days out so every generated slot is in the future.
function targetDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

// Tee slots run 07:00–18:00 every 10 min. Generate the Nth slot time.
function slotTime(n: number): string {
  const totalMin = 7 * 60 + n * 10;
  const hh = String(Math.floor(totalMin / 60)).padStart(2, "0");
  const mm = String(totalMin % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

interface BookResult { status: number; ok: boolean; reason?: string; bookingId?: string; ms: number; }

async function book(opts: {
  date: string; slotTime: string; numPlayers: number; tag: string; ip: string;
}): Promise<BookResult> {
  const t0 = performance.now();
  const res = await fetch(`${BASE}/api/courses/${SLUG}/book`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": opts.ip },
    body: JSON.stringify({
      layoutId: LAYOUT,
      date: opts.date,
      slotTime: opts.slotTime,
      numPlayers: opts.numPlayers,
      holes: 18,
      withCart: false,
      agreedToTerms: true,
      golferName: `Stress ${opts.tag}`,
      golferEmail: `stress-${opts.tag}${MARKER}`,
    }),
  });
  const ms = performance.now() - t0;
  let body: any = {};
  try { body = await res.json(); } catch {}
  return { status: res.status, ok: res.ok, reason: body?.error, bookingId: body?.bookingId, ms };
}

function pct(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return Math.round(s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]);
}

async function confirmedPlayersForSlot(date: string, slot: string): Promise<number> {
  const agg = await prisma.booking.aggregate({
    where: {
      layoutId: LAYOUT,
      bookingDate: new Date(`${date}T00:00:00.000Z`),
      slotTime: slot,
      status: { not: "cancelled" },
    },
    _sum: { numPlayers: true },
  });
  return agg._sum.numPlayers ?? 0;
}

// ── TEST 1: same-millisecond race on ONE slot ───────────────────────────────
async function raceOneSlot(date: string, slotIdx: number, fanout: number) {
  const slot = slotTime(slotIdx);
  // Fire all requests at once — each a distinct IP so the rate limiter never
  // masks the concurrency result.
  const reqs = Array.from({ length: fanout }, (_, i) =>
    book({ date, slotTime: slot, numPlayers: 1, tag: `r${slotIdx}-${i}-${Date.now()}`, ip: `10.0.${slotIdx}.${i + 1}` })
  );
  const results = await Promise.all(reqs);
  const created = results.filter((r) => r.status === 200 || r.status === 201).length;
  const conflict = results.filter((r) => r.status === 409).length;
  const other = results.filter((r) => ![200, 201, 409].includes(r.status));
  const dbPlayers = await confirmedPlayersForSlot(date, slot);
  const overbooked = dbPlayers > MAX_PER_SLOT;
  return { slot, fanout, created, conflict, otherCount: other.length, others: other, dbPlayers, overbooked };
}

// ── TEST 2: rate limiter (same IP hammering one endpoint) ───────────────────
async function rateLimitCheck(date: string) {
  const slot = slotTime(60); // a valid slot (17:00) we won't use elsewhere
  const N = 26; // limit is 20 / 60s
  const reqs = Array.from({ length: N }, (_, i) =>
    book({ date, slotTime: slot, numPlayers: 1, tag: `rl-${i}-${Date.now()}`, ip: "203.0.113.77" })
  );
  const results = await Promise.all(reqs);
  const limited = results.filter((r) => r.status === 429).length;
  return { sent: N, limited };
}

// ── TEST 3: volume burst across many distinct slots ─────────────────────────
// Slots run 07:00–18:00 = 66 ten-minute slots (idx 0..65). To get `count`
// DISTINCT slots without overbooking noise, spread across several dates using
// indices 20..59 (40 usable slots/day, clear of the race + rate-limit slots).
async function volumeBurst(dates: string[], count: number) {
  const targets: { date: string; slotTime: string }[] = [];
  for (const date of dates) {
    for (let idx = 20; idx < 60 && targets.length < count; idx++) {
      targets.push({ date, slotTime: slotTime(idx) });
    }
    if (targets.length >= count) break;
  }
  const reqs = targets.map((t, i) =>
    book({ date: t.date, slotTime: t.slotTime, numPlayers: 1, tag: `v-${i}-${Date.now()}`, ip: `172.16.${Math.floor(i / 254)}.${(i % 254) + 1}` })
  );
  const t0 = performance.now();
  const results = await Promise.all(reqs);
  const wall = performance.now() - t0;
  const okLat = results.filter((r) => r.status === 200 || r.status === 201).map((r) => r.ms);
  const byStatus: Record<number, number> = {};
  for (const r of results) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  return { count, wallMs: Math.round(wall), throughput: +(count / (wall / 1000)).toFixed(1), byStatus, p50: pct(okLat, 50), p95: pct(okLat, 95), max: pct(okLat, 100) };
}

// ── Responsiveness probe: can a normal golfer still load availability while the
// booking flood is hammering the site? Polls in the background; returns latencies.
function startResponsivenessProbe(date: string) {
  const lat: number[] = [];
  let errors = 0;
  let stop = false;
  const runner = (async () => {
    while (!stop) {
      const t0 = performance.now();
      try {
        const res = await fetch(`${BASE}/api/courses/${SLUG}/availability?layoutId=${LAYOUT}&date=${date}`, {
          headers: { "x-forwarded-for": `9.9.9.${Math.floor(Math.random() * 254) + 1}` },
        });
        await res.text();
        if (res.ok) lat.push(performance.now() - t0);
        else errors++;
      } catch { errors++; }
      await new Promise((r) => setTimeout(r, 150));
    }
  })();
  return {
    async stop() { stop = true; await runner; return { lat, errors }; },
  };
}

async function cleanup(): Promise<number> {
  // Delete payments then bookings created by the test (marker email).
  const bookings = await prisma.booking.findMany({
    where: { golferEmail: { endsWith: MARKER } },
    select: { id: true },
  });
  const ids = bookings.map((b) => b.id);
  if (ids.length === 0) return 0;
  await prisma.payment.deleteMany({ where: { bookingId: { in: ids } } });
  await prisma.booking.deleteMany({ where: { id: { in: ids } } });
  return ids.length;
}

async function main() {
  const mode = process.argv[2] ?? "run";
  console.log(`Target host: ${BASE}\n`);
  if (mode === "cleanup") {
    const n = await cleanup();
    console.log(`Cleaned up ${n} test bookings.`);
    await prisma.$disconnect();
    return;
  }

  if (mode === "canary") {
    const date = targetDate(3);
    const slot = slotTime(3); // 07:30
    console.log(`Canary: one booking → ${date} ${slot}`);
    const r = await book({ date, slotTime: slot, numPlayers: 1, tag: `canary-${Date.now()}`, ip: "198.51.100.10" });
    console.log(`   status=${r.status} ok=${r.ok} time=${Math.round(r.ms)}ms`);
    if (r.reason) console.log(`   reason: ${r.reason}`);
    if (r.bookingId) console.log(`   bookingId: ${r.bookingId} (payment step succeeded ✅)`);
    const players = await confirmedPlayersForSlot(date, slot);
    console.log(`   DB confirms ${players} player(s) on that slot`);
    const n = await cleanup();
    console.log(`   cleaned up ${n} canary booking(s)`);
    await prisma.$disconnect();
    return;
  }

  // Safety: clear any leftovers from a prior aborted run first.
  const pre = await cleanup();
  if (pre) console.log(`(cleared ${pre} leftover test bookings first)\n`);

  const date = targetDate(3);
  console.log(`Target: ${SLUG} / ${LAYOUT} / ${date}  (max ${MAX_PER_SLOT} players/slot)\n`);

  // TEST 1 — race, single hot slot, heavy fanout
  console.log("── TEST 1: same-instant race on ONE slot (fanout 12, expect 4 created / 8 conflict) ──");
  const r1 = await raceOneSlot(date, 5, 12);
  console.log(`   slot ${r1.slot}: created=${r1.created} conflict=${r1.conflict} other=${r1.otherCount} | DB players=${r1.dbPlayers} | overbooked=${r1.overbooked ? "❌ YES" : "✅ no"}`);
  if (r1.others.length) console.log("   others:", r1.others.map((o) => `${o.status}:${o.reason}`).join(", "));

  // TEST 1b — repeat the race across several slots for more signal
  console.log("\n── TEST 1b: race repeated across 8 slots (fanout 10 each) ──");
  let anyOver = r1.overbooked;
  for (let s = 10; s < 18; s++) {
    const r = await raceOneSlot(date, s, 10);
    anyOver = anyOver || r.overbooked;
    console.log(`   slot ${r.slot}: created=${r.created} conflict=${r.conflict} | DB players=${r.dbPlayers} ${r.overbooked ? "❌ OVERBOOKED" : "✅"}`);
  }

  // TEST 2 — rate limiter
  console.log("\n── TEST 2: rate limiter (26 requests, same IP, limit 20/60s) ──");
  const r2 = await rateLimitCheck(date);
  console.log(`   sent=${r2.sent} rate-limited(429)=${r2.limited} ${r2.limited > 0 ? "✅ limiter active" : "❌ limiter NOT firing"}`);

  // TEST 3 — volume, with a live responsiveness probe running alongside it
  console.log("\n── TEST 3: volume burst (120 concurrent bookings, distinct slots) ──");
  const probe = startResponsivenessProbe(targetDate(6)); // probe an untouched date
  const r3 = await volumeBurst([targetDate(3), targetDate(4), targetDate(5)], 120);
  const probeRes = await probe.stop();
  console.log(`   wall=${r3.wallMs}ms throughput=${r3.throughput} req/s | booking latency p50=${r3.p50}ms p95=${r3.p95}ms max=${r3.max}ms`);
  console.log(`   status breakdown:`, r3.byStatus);
  console.log(`   FREEZE CHECK — availability page during the flood: samples=${probeRes.lat.length} errors=${probeRes.errors} p50=${pct(probeRes.lat, 50)}ms p95=${pct(probeRes.lat, 95)}ms max=${pct(probeRes.lat, 100)}ms`);

  // Cleanup
  const n = await cleanup();
  console.log(`\n── Cleanup: removed ${n} test bookings ──`);
  console.log(`\nVERDICT: overbooking ${anyOver ? "❌ DETECTED — capacity guard FAILED" : "✅ never occurred — capacity guard held"}`);

  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect().catch(() => {}); process.exit(1); });
