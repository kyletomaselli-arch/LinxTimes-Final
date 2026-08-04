// Captures real product screenshots for the homepage demo carousel.
// Requires the dev server running on :3000 and demo data seeded (_seed-demo.mjs).
import puppeteer from 'puppeteer';

const BASE = 'http://localhost:3000';
const OUT = './public';
const wait = ms => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const log = [];

async function newPage(w = 1200, h = 675, scale = 2) {
  const p = await browser.newPage();
  await p.setViewport({ width: w, height: h, deviceScaleFactor: scale });
  return p;
}
async function shoot(page, file, label) {
  await wait(900);
  await page.screenshot({ path: `${OUT}/${file}` });
  log.push(`OK  ${label} -> ${file}`);
}
// Scroll so the section with `text` sits just below the top of the frame.
async function frame(page, text, offset = 28) {
  await page.evaluate((t, off) => {
    const re = new RegExp(t, 'i');
    const leaf = [...document.querySelectorAll('*')]
      .find(n => n.children.length === 0 && re.test(n.textContent || ''));
    if (leaf) window.scrollTo(0, Math.max(0, leaf.getBoundingClientRect().top + window.scrollY - off));
  }, text, offset);
  await wait(500);
}

try {
  const pub = await newPage();
  await pub.goto(`${BASE}/winged-pheasant-golf-links`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await wait(5500);

  // ---- 1. Public booking: the tee-time grid (prices, availability, waitlist) ----
  // Use tomorrow — "today" late in the afternoon only has twilight left, which
  // makes the grid look sparse.
  await pub.evaluate(() => {
    const days = [...document.querySelectorAll('button')]
      .filter(b => /^(SUN|MON|TUE|WED|THU|FRI|SAT)\s*\d{1,2}/i.test((b.textContent || '').trim()));
    if (days[0]) days[0].click();
  });
  await wait(3500);
  await frame(pub, 'AVAILABLE TEE TIMES', 18);
  await shoot(pub, 'demo-tee-times.png', 'tee-time grid');

  // ---- 2. Checkout: details form + live price summary ----
  // Pick an available slot (skip anything marked Full / waitlist).
  const picked = await pub.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => {
      const t = (x.textContent || '').trim();
      return /^\d{1,2}:\d{2}\s*(AM|PM)/i.test(t) && /spots?\s*·/i.test(t) && !/full|waitlist/i.test(t);
    });
    if (!b) return null;
    b.click();
    return b.textContent.trim().slice(0, 40);
  });
  log.push(`  slot: ${picked ?? 'NONE FOUND'}`);
  await wait(3000);

  // Target fields by placeholder — index order is not stable across states.
  await pub.waitForSelector('input[placeholder="Jane Golfer"]', { timeout: 15000 });
  await pub.type('input[placeholder="Jane Golfer"]', 'Jordan Avery', { delay: 8 });
  await pub.type('input[placeholder="jane@email.com"]', 'jordan.avery@example.com', { delay: 8 });
  await pub.type('input[placeholder="(555) 555-5555"]', '(615) 555-0142', { delay: 8 });
  const terms = await pub.$('input[type="checkbox"]');
  if (terms) await terms.click();
  await wait(900);

  await frame(pub, 'Complete your booking', 20);
  await shoot(pub, 'demo-payment.png', 'checkout + summary');
  await pub.close();

  // ---- 3. Dashboard tee sheet ----
  const dash = await newPage(1920, 1080, 1.5);
  await dash.goto(`${BASE}/dashboard/login`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await wait(1500);
  await dash.type('input[type="email"]', 'pro@wingedpheasant.example.com');
  await dash.type('input[type="password"]', 'course1234!');
  await Promise.all([
    dash.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {}),
    dash.click('button[type="submit"]'),
  ]);
  await wait(2500);
  // Point at tomorrow: late in the day "today" has no upcoming tee times left,
  // which renders an empty sheet.
  const d = new Date(Date.now() + 86400000);
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  await dash.goto(`${BASE}/dashboard?date=${day}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await wait(2500);
  await dash.evaluate(() => window.scrollTo(0, 0));
  await shoot(dash, 'demo-pro-shop.png', `dashboard tee sheet (${day})`);

  // ---- 4. Reports ----
  await dash.goto(`${BASE}/dashboard/reports`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await wait(2500);
  await dash.evaluate(() => window.scrollTo(0, 0));
  await shoot(dash, 'demo-reports.png', 'financial reports');
  await dash.close();
} catch (e) {
  log.push(`ERROR: ${e.message}`);
} finally {
  await browser.close();
  console.log(log.join('\n'));
}
