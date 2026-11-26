// npm run audit:prelaunch   Pre-launch checks (Prompt 11) and the post-deploy spot check (item 9.8), with evidence. Exit 1 on any FAIL.
//
//   npm run build && npm run audit:prelaunch                     against the local build (served from dist/)
//   npm run audit:prelaunch -- --base https://opuscalculator.com  against the deployed site (also item 9.8, 20 random URLs)
//   --sample N     how many pages to spot-check for 9.8 (default 20; the local run checks every page)
//
//  11.1  every published page is 200 and every unpublished one is 404
//  11.4  one h1, a self-referencing canonical and structurally valid JSON-LD on every page
//  11.5  every calculator's default result is in the raw HTML (fetched without running any JavaScript)
//  11.9  the ad slot is below the fold on a phone and a desktop, and reserves its height
// 11.2, 11.3 and 11.6 are enforced on every build by verify-dist and the tests; they are reported here by re-reading the
// built sitemaps and pages. 11.7 (all 14 hubs) and 11.8 (Lighthouse, see scripts/lighthouse-audit.mjs) are separate.
import { chromium } from '@playwright/test';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { getPublishableCalculators, isPublished, registry } from '../src/lib/registry';
import { toWidgetSpec } from '../src/lib/widget-spec';
import { STATIC_PAGES } from '../src/lib/static-pages';

interface Row {
  id: string;
  check: string;
  pass: boolean;
  evidence: string;
}
const rows: Row[] = [];
const add = (id: string, check: string, problems: string[], evidence: string) =>
  rows.push({ id, check, pass: problems.length === 0, evidence: problems.length ? problems.slice(0, 5).join(' | ') : evidence });

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;').replace(/"/g, '&quot;');
const unescapeHtml = (s: string) =>
  s
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
const pick = <T>(items: T[], n: number): T[] => [...items].sort(() => Math.random() - 0.5).slice(0, n);

async function get(base: string, path: string): Promise<{ status: number; html: string }> {
  const res = await fetch(base + path, { redirect: 'follow' });
  return { status: res.status, html: await res.text() };
}

// ---- JSON-LD structure, against the fields Google documents for each type ---------------------------------------------
export function checkJsonLd(html: string): string[] {
  const problems: string[] = [];
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  if (!blocks.length) return ['no JSON-LD block'];
  for (const block of blocks) {
    let data: { '@context'?: string; '@graph'?: Record<string, unknown>[] };
    try {
      data = JSON.parse(block);
    } catch {
      problems.push('JSON-LD does not parse');
      continue;
    }
    if (data['@context'] !== 'https://schema.org') problems.push('JSON-LD @context is not https://schema.org');
    for (const node of data['@graph'] ?? []) {
      const type = node['@type'];
      if (type === 'WebApplication') {
        for (const f of ['name', 'url', 'applicationCategory']) if (!node[f]) problems.push(`WebApplication has no ${f}`);
        const offers = node.offers as { price?: string } | undefined;
        if (offers?.price === undefined) problems.push('WebApplication has no offers.price');
      } else if (type === 'FAQPage') {
        const q = (node.mainEntity as { name?: string; acceptedAnswer?: { text?: string } }[]) ?? [];
        if (!q.length) problems.push('FAQPage has no questions');
        for (const e of q) if (!e.name || !e.acceptedAnswer?.text) problems.push('a FAQ question has no name or answer text');
      } else if (type === 'BreadcrumbList') {
        const items = (node.itemListElement as { position?: number; name?: string; item?: string }[]) ?? [];
        if (!items.length) problems.push('BreadcrumbList is empty');
        items.forEach((it, i) => {
          if (it.position !== i + 1 || !it.name) problems.push('a breadcrumb has a wrong position or no name');
          if (i < items.length - 1 && !it.item) problems.push('a non-final breadcrumb has no item URL');
        });
      } else if (type === 'WebPage') {
        if (!node.lastReviewed) problems.push('a WebPage review node has no lastReviewed');
      } else if (type === 'CollectionPage') {
        if (!node.name || !node.url) problems.push('CollectionPage needs name and url');
      }
    }
  }
  return problems;
}

export default async function main(): Promise<number> {
  const remote = arg('--base');
  const sample = Number(arg('--sample') ?? 20);
  // Import the static server lazily so a remote run does not need dist/.
  const local = remote ? null : await (await import(pathToFileURL(join(process.cwd(), 'scripts', 'static-server.mjs')).href)).startStaticServer();
  const base = (remote ?? local!.base).replace(/\/$/, '');
  console.log(`prelaunch-audit against ${base}${remote ? ` (spot check of ${sample} pages)` : ' (local build, every page)'}\n`);

  const published = getPublishableCalculators();
  const publishedPaths = published.map((c) => `/calculators/${c.slug}/`);
  const sitemapIndex = await get(base, '/sitemap-index.xml');
  const sitemapNames = [...sitemapIndex.html.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  const sitemapPaths = new Set<string>();
  for (const name of sitemapNames) for (const m of (await get(base, name)).html.matchAll(/<loc>([^<]+)<\/loc>/g)) sitemapPaths.add(new URL(m[1]).pathname);
  const allPaths = [...sitemapPaths];
  const toCheck = remote ? pick(allPaths, Math.min(sample, allPaths.length)) : allPaths;

  // 11.1 ------------------------------------------------------------------------------------------------------------
  {
    const problems: string[] = [];
    const unpublished = [
      ...registry.excluded.map((e) => `/calculators/${e.slug}/`),
      ...registry.valid.filter((c) => !isPublished(c)).map((c) => `/calculators/${c.slug}/`),
    ];
    for (const p of remote ? pick(publishedPaths, Math.min(sample, publishedPaths.length)) : publishedPaths) {
      const { status } = await get(base, p);
      if (status !== 200) problems.push(`${p} is ${status}, expected 200`);
    }
    for (const p of STATIC_PAGES.map((s) => s.path)) if ((await get(base, p)).status !== 200) problems.push(`${p} is not 200`);
    for (const p of pick(unpublished, Math.min(40, unpublished.length))) {
      const { status } = await get(base, p);
      if (status !== 404) problems.push(`${p} is unpublished but answers ${status}, expected 404`);
    }
    add(
      '11.1',
      'published pages 200, unpublished pages 404',
      problems,
      `${publishedPaths.length} published calculators and ${STATIC_PAGES.length} site pages are 200; ${Math.min(40, unpublished.length)} of ${unpublished.length} unpublished calculators sampled are 404`,
    );
  }

  // 11.2 and 11.3 --------------------------------------------------------------------------------------------------------
  {
    const problems: string[] = [];
    const unpublished = new Set([
      ...registry.excluded.map((e) => `/calculators/${e.slug}/`),
      ...registry.valid.filter((c) => !isPublished(c)).map((c) => `/calculators/${c.slug}/`),
    ]);
    for (const p of allPaths) if (unpublished.has(p)) problems.push(`a sitemap lists the unpublished page ${p}`);
    add('11.2', 'no sitemap contains an unpublished URL', problems, `${allPaths.length} sitemap URLs in ${sitemapNames.length} file(s), none unpublished`);
    const linkProblems: string[] = [];
    for (const p of toCheck) {
      const { html } = await get(base, p);
      for (const m of html.matchAll(/<a\s[^>]*?href="(\/calculators\/[^"#?]+\/?)"/g)) {
        const to = m[1].endsWith('/') ? m[1] : `${m[1]}/`;
        if (unpublished.has(to)) linkProblems.push(`${p} links to the unpublished page ${to}`);
      }
    }
    add('11.3', 'no rendered HTML links to an unpublished slug', linkProblems, `${toCheck.length} pages read, no link to an unpublished calculator`);
  }

  // 11.4 -----------------------------------------------------------------------------------------------------------
  {
    const problems: string[] = [];
    const titles = new Map<string, string>();
    for (const p of toCheck) {
      const { html } = await get(base, p);
      const h1 = (html.match(/<h1[\s>]/g) ?? []).length;
      if (h1 !== 1) problems.push(`${p} has ${h1} h1 elements`);
      const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
      if (canonical !== `https://opuscalculator.com${p}`) problems.push(`${p} canonical is ${canonical ?? 'missing'}`);
      const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
      if (titles.has(title)) problems.push(`${p} repeats the title of ${titles.get(title)}`);
      titles.set(title, p);
      if (p.startsWith('/calculators/') || p.startsWith('/categories/')) for (const j of checkJsonLd(html)) problems.push(`${p}: ${j}`);
    }
    add(
      '11.4',
      'one h1, self-referencing canonical, valid JSON-LD, unique title',
      problems,
      `${toCheck.length} pages: exactly one h1, canonical equals its own URL on https://opuscalculator.com, JSON-LD parses and has the documented fields, no duplicate title`,
    );
  }

  // 11.5 -----------------------------------------------------------------------------------------------------------
  {
    const problems: string[] = [];
    const subset = remote ? pick(published, Math.min(sample, published.length)) : published;
    for (const c of subset) {
      const { html } = await get(base, `/calculators/${c.slug}/`);
      const spec = toWidgetSpec(c);
      const plain = unescapeHtml(html);
      for (const o of c.outputs.filter((o) => o.highlight)) {
        const shown = spec.initialResults[o.name];
        if (!shown || !(html.includes(escapeHtml(shown)) || plain.includes(shown)))
          problems.push(`/calculators/${c.slug}/ does not contain its default ${o.name} "${shown}" in the raw HTML`);
      }
    }
    add(
      '11.5',
      'default result in the raw HTML (no JavaScript run)',
      problems,
      `${subset.length} calculators fetched as plain HTML; every highlighted default result is present in the markup`,
    );
  }

  // 11.9 -----------------------------------------------------------------------------------------------------------
  {
    const problems: string[] = [];
    const browser = await chromium.launch({
      headless: true,
      ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' }),
    });
    const heights: string[] = [];
    try {
      for (const viewport of [
        { width: 390, height: 844, name: 'phone' },
        { width: 1280, height: 800, name: 'desktop' },
      ]) {
        const context = await browser.newContext({ viewport });
        const page = await context.newPage();
        for (const path of remote ? pick(publishedPaths, Math.min(5, publishedPaths.length)) : publishedPaths) {
          await page.goto(base + path, { waitUntil: 'load' });
          const info = await page.evaluate(() => {
            const slot = document.querySelector('[data-ad-slot]');
            if (!slot) return null;
            const r = slot.getBoundingClientRect();
            return {
              top: r.top + window.scrollY,
              height: r.height,
              inner: window.innerHeight,
              focusable: !!slot.querySelector('a[href], button, input, select, [tabindex]'),
            };
          });
          if (!info) problems.push(`${path} has no ad slot`);
          else {
            if (info.top < info.inner)
              problems.push(`${path} [${viewport.name}] ad slot starts at ${Math.round(info.top)}px, inside the first ${info.inner}px screen`);
            if (info.height < 200)
              problems.push(
                `${path} [${viewport.name}] ad slot is only ${Math.round(info.height)}px tall: it does not reserve room, so an ad would shift the page`,
              );
            if (info.focusable) problems.push(`${path} the ad slot holds a focusable element before any ad loads`);
            if (viewport.name === 'desktop') heights.push(`${Math.round(info.top)}`);
          }
        }
        await context.close();
      }
    } finally {
      await browser.close();
    }
    add(
      '11.9',
      'ad slot below the fold and reserving its height',
      problems,
      `on a 390x844 phone and a 1280x800 desktop the slot starts below the first screen (desktop tops ${heights.join(', ')} px) and is at least 200 px tall; the loader waits for window load, then browser idle, then 200 px proximity`,
    );
  }

  // report ----------------------------------------------------------------------------------------------------------
  console.log('| Item | Check | Result | Evidence |\n| --- | --- | --- | --- |');
  for (const r of rows) console.log(`| ${r.id} | ${r.check} | ${r.pass ? 'PASS' : 'FAIL'} | ${r.evidence} |`);
  if (local) await local.close();
  const failed = rows.filter((r) => !r.pass).length;
  console.log(failed ? `\nprelaunch-audit FAILED: ${failed} check(s)` : '\nprelaunch-audit OK');
  return failed ? 1 : 0;
}
