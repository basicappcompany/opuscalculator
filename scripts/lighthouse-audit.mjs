// npm run lighthouse   Lighthouse on 5 random published pages: 3 mobile and 2 desktop (items 9.3 and 11.8).
//
//   npm run build && npm run lighthouse                          the local build, served with Brotli and caching like Cloudflare Pages
//   npm run lighthouse -- --base https://opuscalculator.com       the deployed site (the check that counts for launch)
//
// Fails (exit 1) if any mobile page scores under 90 for performance. Accessibility, best practices and SEO are reported too.
// Lighthouse is fetched with npx at run time and is not a dependency of the project. It uses the Chrome already installed.
// Scores from a busy machine are lower than real ones: close other programs, and treat the deployed run as the truth.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startStaticServer } from './static-server.mjs';

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const remote = arg('--base');
const served = remote ? null : await startStaticServer(undefined, 0, { production: true });
const base = (remote ?? served.base).replace(/\/$/, '');

const sitemapPaths = async () => {
  const index = await (await fetch(`${base}/sitemap-index.xml`)).text();
  const paths = [];
  for (const m of index.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const xml = await (await fetch(base + new URL(m[1]).pathname)).text();
    for (const u of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) paths.push(new URL(u[1]).pathname);
  }
  return paths;
};
const paths = (await sitemapPaths()).sort(() => Math.random() - 0.5).slice(0, 5);
const plan = paths.map((path, i) => ({ path, preset: i < 3 ? 'mobile' : 'desktop' }));

const dir = mkdtempSync(join(tmpdir(), 'opus-lh-'));
const chrome = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const results = [];
for (const [i, { path, preset }] of plan.entries()) {
  const out = join(dir, `run${i}.json`);
  const args = [
    '-y',
    'lighthouse@12',
    base + path,
    '--only-categories=performance,accessibility,best-practices,seo',
    '--chrome-flags=--headless=new --no-sandbox',
    '--output=json',
    `--output-path=${out}`,
    '--quiet',
  ];
  if (preset === 'desktop') args.push('--preset=desktop');
  try {
    execFileSync(npx, args, { stdio: 'ignore', env: { ...process.env, CHROME_PATH: chrome }, shell: process.platform === 'win32' });
    const r = JSON.parse(readFileSync(out, 'utf8'));
    const s = (k) => Math.round(r.categories[k].score * 100);
    const a = r.audits;
    results.push({
      path,
      preset,
      perf: s('performance'),
      a11y: s('accessibility'),
      bp: s('best-practices'),
      seo: s('seo'),
      lcp: a['largest-contentful-paint'].displayValue,
      tbt: a['total-blocking-time'].displayValue,
      cls: a['cumulative-layout-shift'].displayValue,
    });
  } catch (error) {
    results.push({ path, preset, error: String(error.message).slice(0, 120) });
  }
}
if (served) await served.close();

console.log(`Lighthouse on ${base}\n`);
console.log('| Page | Preset | Perf | A11y | Best practices | SEO | LCP | TBT | CLS |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
for (const r of results)
  console.log(
    r.error
      ? `| ${r.path} | ${r.preset} | ERROR ${r.error} |||||||`
      : `| ${r.path} | ${r.preset} | ${r.perf} | ${r.a11y} | ${r.bp} | ${r.seo} | ${r.lcp} | ${r.tbt} | ${r.cls} |`,
  );
const bad = results.filter((r) => r.error || (r.preset === 'mobile' && r.perf < 90));
console.log(
  bad.length
    ? `\nlighthouse FAILED: ${bad.length} page(s) under 90 on mobile performance, or errored`
    : '\nlighthouse OK: every mobile page scores 90 or more for performance',
);
process.exit(bad.length ? 1 : 0);
