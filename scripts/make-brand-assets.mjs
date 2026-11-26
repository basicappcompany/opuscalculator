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

// The favicon.ico is drawn directly (a gradient rounded square with the letter "O" in a 3x5 pixel font), because a
// headless browser will not render a 48-pixel window. Modern browsers use favicon.svg; the ICO is the fallback.
import { crc32, deflateSync } from 'node:zlib';

const SIZE = 48;
const GLYPHS = { O: ['111', '101', '101', '101', '111'] };
const from = [0x4f, 0x46, 0xe5];
const to = [0x7c, 0x3a, 0xed];
const radius = 10;
const rgba = Buffer.alloc(SIZE * SIZE * 4);
const inside = (x, y) => {
  const cx = Math.min(Math.max(x, radius), SIZE - 1 - radius);
  const cy = Math.min(Math.max(y, radius), SIZE - 1 - radius);
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
};
const scale = 5;
const textW = 3 * scale;
const x0 = Math.floor((SIZE - textW) / 2);
const y0 = Math.floor((SIZE - 5 * scale) / 2);
const isInk = (x, y) => {
  const rx = x - x0;
  const ry = y - y0;
  if (rx < 0 || ry < 0 || ry >= 5 * scale) return false;
  if (rx >= textW) return false;
  return GLYPHS.O[Math.floor(ry / scale)][Math.floor(rx / scale)] === '1';
};
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const o = (y * SIZE + x) * 4;
    if (!inside(x, y)) continue; // transparent corner
    const t = (x + y) / (2 * (SIZE - 1));
    const ink = isInk(x, y);
    for (let c = 0; c < 3; c++) rgba[o + c] = ink ? 255 : Math.round(from[c] + (to[c] - from[c]) * t);
    rgba[o + 3] = 255;
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
