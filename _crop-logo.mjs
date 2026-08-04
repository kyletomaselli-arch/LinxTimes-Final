// Auto-crops the whitespace around the LinxTimes wordmark and writes a tight PNG.
import puppeteer from 'puppeteer';
import fs from 'fs';

const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
const b64 = fs.readFileSync('public/logo.jpg').toString('base64');

const out = await p.evaluate(async (b64) => {
  const img = new Image();
  img.src = 'data:image/jpeg;base64,' + b64;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data;

  // Bounding box of pixels that are meaningfully darker than white.
  let minX = c.width, minY = c.height, maxX = -1, maxY = -1;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      const i = (y * c.width + x) * 4;
      if (d[i] < 235 || d[i + 1] < 235 || d[i + 2] < 235) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;

  const pad = 4;
  minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
  maxX = Math.min(c.width - 1, maxX + pad); maxY = Math.min(c.height - 1, maxY + pad);
  const w = maxX - minX + 1, h = maxY - minY + 1;

  // Upscale 4x so it stays crisp on retina at header size.
  const S = 4;
  const o = document.createElement('canvas');
  o.width = w * S; o.height = h * S;
  const og = o.getContext('2d');
  og.imageSmoothingEnabled = true;
  og.imageSmoothingQuality = 'high';
  og.drawImage(c, minX, minY, w, h, 0, 0, w * S, h * S);

  // Knock the white JPEG matte out to alpha so the mark sits on any background.
  // Saturated pixels (the red flag) are kept fully opaque; neutral pixels fade
  // by lightness, which preserves the anti-aliased letter edges.
  const id = og.getImageData(0, 0, o.width, o.height);
  const px = id.data;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i], g2 = px[i + 1], b2 = px[i + 2];
    const mx = Math.max(r, g2, b2), mn = Math.min(r, g2, b2);
    px[i + 3] = (mx - mn) > 40 ? 255 : Math.max(0, 255 - mn);
  }
  og.putImageData(id, 0, 0);

  return { data: o.toDataURL('image/png'), box: { minX, minY, w, h } };
}, b64);

await b.close();
if (!out) { console.log('no content found'); process.exit(1); }
fs.writeFileSync('public/logo-wordmark.png', Buffer.from(out.data.split(',')[1], 'base64'));
console.log(`cropped to ${out.box.w}x${out.box.h} (from 200x200) -> public/logo-wordmark.png`);
