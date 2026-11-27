// Regenerates the raster brand assets from their sources, using the Chrome already on the machine (headless):
//   public/og-template.png  1200 x 630, from scripts/brand/og-template.html
//   public/favicon.ico      48 x 48 PNG inside an ICO container, drawn in code (see below)
// Run when the mark or the tagline changes:   node scripts/make-brand-assets.mjs
// The outputs are committed, so a normal build does not need Chrome.
import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const candidates = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);
const chrome = candidates.find((p) => existsSync(p));
if (!chrome) {
  console.error('No Chrome found. Set CHROME_PATH to a Chrome or Chromium executable.');
  process.exit(1);
}

const shot = (url, out, w, h) =>
  execFileSync(chrome, ['--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', `--window-size=${w},${h}`, `--screenshot=${out}`, url], {
    stdio: 'ignore',
  });

const og = resolve('public/og-template.png');
shot(pathToFileURL(resolve('scripts/brand/og-template.html')).href, og, 1200, 630);
console.log('wrote', og);

// The favicon.ico is drawn directly from the same shapes as public/logo-mark.svg (a gradient ring with three nodes), 4x4
// supersampled, because a headless browser will not render a 48-pixel window. Modern browsers use favicon.svg; the ICO is the fallback.
import { crc32, deflateSync } from 'node:zlib';

const SIZE = 48;
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const stops = [hex('#ff4fa3'), hex('#7a5cff'), hex('#1fb6ff')];
const ringColour = (t) => {
  const p = Math.min(Math.max(t, 0), 1) * 2;
  const i = Math.min(Math.floor(p), 1);
  return stops[i].map((c, k) => c + (stops[i + 1][k] - c) * (p - i));
};
const dots = [
  [52, 32, 7, hex('#ffb020')],
  [22, 49.3, 7, hex('#12c2b0')],
  [22, 14.7, 7, hex('#ff4fa3')],
];
// Colour and coverage of one point in the 64-unit logo space, or null when it is empty.
const sample = (x, y) => {
  for (const [cx, cy, r, c] of dots) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) return c;
  const d = Math.hypot(x - 32, y - 32);
  if (Math.abs(d - 20) <= 2.5) return ringColour((x + y) / 128);
  return null;
};
const rgba = Buffer.alloc(SIZE * SIZE * 4);
const SS = 4;
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    let r = 0,
      g = 0,
      b = 0,
      n = 0;
    for (let sy = 0; sy < SS; sy++)
      for (let sx = 0; sx < SS; sx++) {
        const c = sample(((x + (sx + 0.5) / SS) * 64) / SIZE, ((y + (sy + 0.5) / SS) * 64) / SIZE);
        if (c) {
          r += c[0];
          g += c[1];
          b += c[2];
          n++;
        }
      }
    const o = (y * SIZE + x) * 4;
    if (n) {
      rgba[o] = Math.round(r / n);
      rgba[o + 1] = Math.round(g / n);
      rgba[o + 2] = Math.round(b / n);
      rgba[o + 3] = Math.round((n / (SS * SS)) * 255);
    }
  }
}
const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE); // each scanline starts with filter byte 0
for (let y = 0; y < SIZE; y++) rgba.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
const chunk = (type, body) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(body.length);
  const typed = Buffer.concat([Buffer.from(type), body]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed) >>> 0);
  return Buffer.concat([len, typed, crc]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // colour type: RGBA
const data = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
]);

const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(1, 4); // one image
header[6] = SIZE; // width
header[7] = SIZE; // height
header.writeUInt16LE(1, 10); // colour planes
header.writeUInt16LE(32, 12); // bits per pixel
header.writeUInt32LE(data.length, 14); // image size in bytes
header.writeUInt32LE(22, 18); // image offset: right after the 6-byte directory and the 16-byte entry
writeFileSync('public/favicon.ico', Buffer.concat([header, data]));
console.log('wrote public/favicon.ico', data.length, 'bytes of PNG');
