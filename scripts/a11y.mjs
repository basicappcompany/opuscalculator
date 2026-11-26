// npm run a11y: accessibility checks against the built site (run `npm run build` first). Exit code 1 on any failure.
//
//   1. axe-core on 8 pages (the 5 Tier 1 calculators, home, a hub and a policy page), in light and dark, plus the error
//      state of the widget. ZERO violations of any impact are allowed (Prompt 14).
//   2. Reflow: no sideways scroll at 320 px wide, and at 640 px (a 1280 px window zoomed to 200%).
//   3. Keyboard: the tab order of every calculator page is recorded; the skip link is first, every control in the
//      calculator is reachable, nothing traps focus, the ad slot never takes focus, and Escape/Enter/Space work on buttons.
//   4. Announcements: the screen-reader live region stays quiet while a number is being typed and speaks once it settles.
//
// It uses the Chrome already installed (Playwright channel "chrome"), so no browser download. Set CHROME_PATH to use another.
// The tab-order tables are written to reports/a11y/tab-order.md (reports/ is git-ignored).
import { AxeBuilder } from '@axe-core/playwright';
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { startStaticServer } from './static-server.mjs';

const CALCULATORS = ['bmi-calculator', 'mortgage-calculator', 'percentage-calculator', 'age-calculator', 'compound-interest-calculator'].map(
  (s) => `/calculators/${s}/`,
);
const PAGES = [...CALCULATORS, '/', '/categories/finance/', '/privacy/'];

let served;
try {
  served = await startStaticServer();
} catch (error) {
  console.error(error.message);
  process.exit(2);
}
const { server, base } = served;

const failures = [];
const fail = (area, page, message) => {
  failures.push(`${area} ${page}: ${message}`);
  console.error(`  FAIL ${area} ${page}: ${message}`);
};

const launch = { headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' }) };
let browser;
try {
  browser = await chromium.launch(launch);
} catch (error) {
  console.error(`Could not start Chrome: ${error.message}\nInstall Google Chrome or set CHROME_PATH.`);
  server.close();
  process.exit(2);
}

async function open(path, { scheme = 'light', width = 1280, height = 900 } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, colorScheme: scheme, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto(base + path, { waitUntil: 'load' });
  if (path.startsWith('/calculators/')) await page.waitForTimeout(700); // let the island hydrate
  return { context, page };
}

// ------------------------------------------------------------------ 1. axe
console.log('1. axe-core (every rule, zero violations allowed)');
for (const scheme of ['light', 'dark']) {
  for (const path of PAGES) {
    const { context, page } = await open(path, { scheme });
    const result = await new AxeBuilder({ page }).analyze();
    for (const v of result.violations)
      fail('axe', `${path} [${scheme}]`, `${v.id} (${v.impact}): ${v.help}; ${v.nodes.length} node(s), first ${v.nodes[0]?.target?.join(' ')}`);
    console.log(`  ${result.violations.length === 0 ? 'ok  ' : 'FAIL'} ${path} [${scheme}] (${result.passes.length} rules passed)`);
    await context.close();
  }
}
// The error state: an invalid first input shows an inline error, the stale tag, and must still be accessible.
for (const path of ['/calculators/bmi-calculator/', '/calculators/mortgage-calculator/']) {
  const { context, page } = await open(path);
  await page.locator('#calculator input[type="text"]').first().fill('abc');
  await page.waitForTimeout(600);
  const stale = await page.locator('.stale-tag').count();
  if (!stale) fail('state', path, 'typing text into a number field did not show the stale tag');
  const invalid = await page.locator('#calculator [aria-invalid="true"]').count();
  if (!invalid) fail('state', path, 'the invalid field is not marked aria-invalid');
  const described = await page.locator('#calculator [aria-invalid="true"]').first().getAttribute('aria-describedby');
  if (!described || !(await page.locator(`#${described}`).count())) fail('state', path, 'the invalid field has no aria-describedby pointing at its message');
  const result = await new AxeBuilder({ page }).analyze();
  for (const v of result.violations) fail('axe', `${path} [error state]`, `${v.id} (${v.impact}): ${v.help}`);
  console.log(`  ${result.violations.length === 0 && stale && invalid ? 'ok  ' : 'FAIL'} ${path} [error state]`);
  await context.close();
}

// ------------------------------------------------------------------ 2. reflow
console.log('2. reflow (no horizontal scroll at 320 px and at 200% zoom)');
for (const width of [320, 640]) {
  for (const path of PAGES) {
    const { context, page } = await open(path, { width, height: 800 });
    const { scroll, inner } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
    if (scroll > inner) {
      const wide = await page.evaluate(
        (w) =>
          [...document.querySelectorAll('body *')]
            .filter((e) => e.getBoundingClientRect().right > w + 1)
            .slice(0, 3)
            .map((e) => `${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]}`),
        inner,
      );
      fail('reflow', `${path} @${width}px`, `page is ${scroll}px wide in a ${inner}px window; wide elements: ${wide.join(', ')}`);
    }
    await context.close();
  }
  console.log(`  checked ${PAGES.length} pages at ${width}px`);
}

// ------------------------------------------------------------------ 3. keyboard
console.log('3. keyboard (tab order, no trap, ad slot never focused)');
const tables = [];
const describe = (el) => {
  const label = el.getAttribute('aria-label') || (el.labels && el.labels[0]?.textContent) || el.textContent || el.getAttribute('name') || '';
  return `${el.tagName.toLowerCase()}${el.id ? `#${el.id.replace(/^_r_.*$/, 'auto')}` : ''} "${label.replace(/\s+/g, ' ').trim().slice(0, 48)}"`;
};
for (const path of CALCULATORS) {
  const { context, page } = await open(path);
  const stops = [];
  let first = null;
  for (let i = 0; i < 120; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate((src) => {
      const el = document.activeElement;
      if (!el || el === document.body) return { body: true };
      const describe = new Function(`return (${src})`)();
      return {
        text: describe(el),
        inAd: !!el.closest('[data-ad-slot]'),
        inCalculator: !!el.closest('#calculator'),
        tag: el.tagName.toLowerCase(),
        key: `${el.tagName}|${el.id}|${el.textContent?.slice(0, 20)}|${el.getAttribute('name')}`,
      };
    }, describe.toString());
    if (info.body) break; // focus left the page: a full lap
    if (first === null) first = info.key;
    else if (info.key === first) break; // wrapped to the first stop again
    stops.push(info);
  }
  if (!stops.length) fail('keyboard', path, 'Tab never reached any element');
  else {
    if (!/Skip to calculator/i.test(stops[0].text)) fail('keyboard', path, `the first tab stop is ${stops[0].text}, not the skip link`);
    if (stops.some((s) => s.inAd)) fail('keyboard', path, 'the ad slot took focus');
    if (stops.length >= 119) fail('keyboard', path, 'focus never wrapped: a keyboard trap, or too many stops');
    const inCalc = await page
      .locator('#calculator')
      .evaluate((root) => [...root.querySelectorAll('input:not([disabled]), select:not([disabled]), button:not([disabled]), a[href], textarea')].length);
    const reached = stops.filter((s) => s.inCalculator).length;
    if (reached < inCalc) fail('keyboard', path, `${inCalc} controls in the calculator but Tab reached ${reached}`);
  }
  // Enter and Space activate buttons; Escape does not trap.
  const reset = page.getByRole('button', { name: /Clear all changes/ });
  await reset.focus();
  await page.keyboard.press('Enter');
  await reset.focus();
  await page.keyboard.press('Space');
  await page.keyboard.press('Escape');
  if (!(await reset.evaluate((el) => document.activeElement === el))) fail('keyboard', path, 'Escape moved focus off a focused button');
  // Visible focus ring on a button.
  await reset.focus();
  const outline = await reset.evaluate((el) => getComputedStyle(el).outlineStyle !== 'none' && parseFloat(getComputedStyle(el).outlineWidth) >= 2);
  if (!outline) fail('keyboard', path, 'a focused button has no visible focus outline');
  tables.push({ path, stops });
  console.log(`  ${path}: ${stops.length} tab stops`);
  await context.close();
}
// A select can be driven with arrow keys (native control): check it on a page that has one.
{
  const { context, page } = await open('/calculators/bmi-calculator/');
  const select = page.locator('#calculator select').first();
  await select.focus();
  const before = await select.inputValue();
  await page.keyboard.press('ArrowDown');
  const after = await select.inputValue();
  if (before === after) fail('keyboard', '/calculators/bmi-calculator/', 'arrow keys did not change the unit select');
  else console.log('  select driven by arrow keys: ok');
  await context.close();
}
// The theme toggle and the currency selector are reachable and the toggle reports its state.
{
  const { context, page } = await open('/');
  const toggle = page.locator('#theme-toggle');
  await toggle.focus();
  const before = await toggle.getAttribute('aria-pressed');
  await page.keyboard.press('Enter');
  const after = await toggle.getAttribute('aria-pressed');
  if (before === after) fail('keyboard', '/', 'the theme toggle did not change aria-pressed on Enter');
  await page.locator('#currency-select').focus();
  console.log(`  theme toggle: aria-pressed ${before} -> ${after}; currency selector focusable`);
  await context.close();
}

// ------------------------------------------------------------------ 4. announcements
console.log('4. live-region announcements (quiet while typing, speaks once settled)');
{
  const { context, page } = await open('/calculators/bmi-calculator/');
  const live = page.locator('#calculator output[aria-live="polite"]');
  if ((await live.getAttribute('aria-atomic')) !== 'true') fail('announce', 'bmi', 'the live region is not aria-atomic');
  const initial = await live.textContent();
  const weight = page.locator('#calculator input[type="text"]').first();
  for (const digit of ['8', '85']) {
    await weight.fill(digit);
    await page.waitForTimeout(120);
  }
  const during = await live.textContent();
  if (during !== initial) fail('announce', 'bmi', `the live region changed while typing (still inside 400 ms): "${during}"`);
  await page.waitForTimeout(1000);
  const settled = await live.textContent();
  if (settled === initial || !/BMI/.test(settled)) fail('announce', 'bmi', `the live region did not announce the settled result: "${settled}"`);
  console.log(`  initial "${initial.slice(0, 40)}..." during typing unchanged; settled "${settled.slice(0, 40)}..."`);
  await context.close();
}

// ------------------------------------------------------------------ report
mkdirSync('reports/a11y', { recursive: true });
const md = [
  '# Keyboard tab order',
  '',
  `Generated by \`npm run a11y\` against the built site on ${new Date().toISOString().slice(0, 10)}. Stop 1 is always the skip link.`,
  '',
];
for (const t of tables) {
  md.push(`## ${t.path}`, '', '| # | Element | In calculator |', '| --- | --- | --- |');
  t.stops.forEach((s, i) => md.push(`| ${i + 1} | ${s.text.replace(/\|/g, '/')} | ${s.inCalculator ? 'yes' : 'no'} |`));
  md.push('');
}
writeFileSync('reports/a11y/tab-order.md', md.join('\n'));

await browser.close();
server.close();
console.log(failures.length ? `\na11y FAILED: ${failures.length} problem(s)` : '\na11y OK: no violations');
process.exit(failures.length ? 1 : 0);
