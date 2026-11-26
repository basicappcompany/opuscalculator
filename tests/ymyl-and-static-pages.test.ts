import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import bmi from '../src/calculators/bmi-calculator';
import mortgage from '../src/calculators/mortgage-calculator';
import percentage from '../src/calculators/percentage-calculator';
import { DISCLAIMERS, YMYL_CATEGORIES, disclaimerFor, isYmyl } from '../src/content/disclaimers';
import { REVIEWERS } from '../src/content/reviewers';
import { checkDist } from '../src/lib/audit';
import { CATEGORIES } from '../src/lib/types';
import { collectEntries } from '../src/lib/sitemaps';
import { calculatorJsonLd } from '../src/lib/seo';
import { FOOTER_PAGES, REQUIRED_FOOTER_PATHS, STATIC_PAGES } from '../src/lib/static-pages';
import { longDateLabel, reviewInfo } from '../src/lib/ymyl';
import { prelaunchItems } from '../scripts/prelaunch';

const graph = (config: typeof bmi) =>
  (calculatorJsonLd(config, `/calculators/${config.slug}/`, [{ label: 'Home', href: '/' }, { label: config.h1 }]) as { '@graph': Record<string, unknown>[] })[
    '@graph'
  ];

describe('YMYL disclaimers (Prompt 12)', () => {
  it("uses the plan's exact wording for health and finance", () => {
    expect(DISCLAIMERS.health).toBe(
      'This calculator is for informational and educational purposes only. It is not a substitute for professional medical advice, diagnosis, or treatment. Always consult a qualified healthcare provider before making decisions about your health.',
    );
    expect(DISCLAIMERS.finance).toBe(
      'This calculator is for educational and informational purposes only and does not constitute financial, investment, or tax advice. Consult a licensed financial professional before making decisions.',
    );
  });

  it('non-YMYL categories have no disclaimer, YMYL categories all have one', () => {
    for (const c of ['math', 'physics', 'conversion', 'everyday-life', 'statistics', 'sports', 'ecology'] as const) expect(disclaimerFor(c), c).toBeUndefined();
    for (const c of YMYL_CATEGORIES) expect(disclaimerFor(c), c).toBeTruthy();
    expect(CATEGORIES.every((c) => isYmyl(c) === YMYL_CATEGORIES.includes(c))).toBe(true);
  });

  it('every layout renders the Disclaimer between the widget and the ad slot', () => {
    for (const layout of ['LayoutA', 'LayoutB', 'LayoutC']) {
      const src = readFileSync(`src/components/calculator/layouts/${layout}.astro`, 'utf8');
      expect(src, layout).toContain('<Disclaimer');
      const widget = src.indexOf('<slot name="widget"');
      const disclaimer = src.indexOf('<Disclaimer');
      const ad = src.indexOf('<AdSlot />');
      expect(widget).toBeLessThan(disclaimer);
      expect(disclaimer).toBeLessThan(ad);
    }
  });

  it('the disclaimer is an aside role="note" with class disclaimer, in server HTML, not a modal or tooltip', () => {
    const markup = readFileSync('src/components/Disclaimer.astro', 'utf8').split('---').slice(2).join('---'); // the template, not the frontmatter comments
    expect(markup).toContain('<aside role="note" class="disclaimer');
    expect(markup).not.toMatch(/client:|<dialog|tooltip|aria-modal/i);
  });
});

describe('reviewers and review markup', () => {
  it('reviewers are seeded empty: no fabricated credentials', () => {
    expect(Object.keys(REVIEWERS)).toEqual([]);
  });

  it("formats dates and falls back to the calculator's last-updated date when there is no reviewer", () => {
    expect(longDateLabel('2026-11-22')).toBe('22 November 2026');
    expect(reviewInfo('health', '2026-11-22')).toEqual({ date: '2026-11-22', dateLabel: '22 November 2026' });
  });

  it("a YMYL calculator's JSON-LD has lastReviewed, no reviewedBy without a reviewer, and a publisher", () => {
    const nodes = graph(bmi);
    const page = nodes.find((n) => n['@type'] === 'WebPage')!;
    expect(page.lastReviewed).toBe(bmi.lastUpdated);
    expect(page).not.toHaveProperty('reviewedBy');
    expect(page.publisher).toMatchObject({ '@type': 'Organization', name: 'Opus Calculator', url: 'https://opuscalculator.com' });
    expect(nodes.find((n) => n['@type'] === 'WebApplication')!.publisher).toMatchObject({ name: 'Opus Calculator' });
    expect(page.mainEntity).toEqual({ '@id': nodes.find((n) => n['@type'] === 'WebApplication')!['@id'] });
    expect(graph(mortgage).some((n) => n['@type'] === 'WebPage')).toBe(true);
  });

  it('a non-YMYL calculator has the publisher but no review node', () => {
    const nodes = graph(percentage);
    expect(nodes.some((n) => n['@type'] === 'WebPage')).toBe(false);
    expect(nodes.find((n) => n['@type'] === 'WebApplication')!.publisher).toBeDefined();
  });

  it('the editorial policy states the review process for unaudited calculators (the rule that lets YMYL pages publish with no reviewer)', () => {
    const src = readFileSync('src/pages/editorial-policy.astro', 'utf8');
    expect(src).toMatch(/Unaudited calculators/);
    expect(src).toMatch(/last reviewed/i);
  });
});

describe("the site's own pages", () => {
  it('every listed page has a page file, a unique title and description, and is linked from the footer', () => {
    const files = new Set(readdirSync('src/pages'));
    for (const p of STATIC_PAGES) {
      const name = `${p.path.replaceAll('/', '')}.astro`;
      expect(files.has(name), p.path).toBe(true);
      expect(p.title.length, p.path).toBeLessThanOrEqual(70);
      expect(p.description.length, p.path).toBeLessThanOrEqual(170);
    }
    expect(new Set(STATIC_PAGES.map((p) => p.title)).size).toBe(STATIC_PAGES.length);
    expect(new Set(STATIC_PAGES.map((p) => p.description)).size).toBe(STATIC_PAGES.length);
    for (const required of [
      '/about/',
      '/contact/',
      '/editorial-policy/',
      '/privacy/',
      '/terms/',
      '/ad-disclosure/',
      '/accessibility/',
      '/dmca/',
      '/how-we-make-money/',
    ]) {
      expect(REQUIRED_FOOTER_PATHS).toContain(required);
    }
    expect(FOOTER_PAGES.length).toBe(STATIC_PAGES.length);
  });

  it('every page has substantial real content, one h1 from the layout and no lorem ipsum', () => {
    for (const p of STATIC_PAGES) {
      const src = readFileSync(join('src/pages', `${p.path.replaceAll('/', '')}.astro`), 'utf8');
      const words = src
        .replace(/---[\s\S]*?---/, '')
        .replace(/<[^>]+>/g, ' ')
        .split(/\s+/)
        .filter(Boolean).length;
      expect(words, p.path).toBeGreaterThan(150);
      expect(src, p.path).not.toMatch(/lorem ipsum/i);
      expect(src.match(/<h1/g) ?? [], p.path).toHaveLength(0); // the h1 comes from StaticPage
    }
  });

  it('privacy, terms, ad disclosure, accessibility and DMCA cover what the plan requires', () => {
    const read = (n: string) => readFileSync(`src/pages/${n}.astro`, 'utf8');
    expect(read('privacy')).toMatch(/NID/);
    expect(read('privacy')).toMatch(/ANID/);
    expect(read('privacy')).toMatch(/plausible\.io\/data-policy/);
    expect(read('privacy')).toMatch(/adssettings\.google\.com/);
    expect(read('privacy')).toMatch(/GDPR/);
    expect(read('privacy')).toMatch(/CCPA/);
    expect(read('terms')).toMatch(/Limitation of liability/);
    expect(read('terms')).toMatch(/Governing law/);
    expect(read('ad-disclosure')).toMatch(/Ads are always below the calculator/);
    expect(read('ad-disclosure')).toMatch(/never\s+influenced by the calculation/);
    expect(read('dmca')).toMatch(/counter-notice/i);
    expect(read('accessibility')).toMatch(/SITE\.accessibilityTarget/);
  });

  it('are all in the sitemap, so a linked page is a listed page', () => {
    const paths = new Set(collectEntries().map((e) => e.path));
    for (const p of STATIC_PAGES) expect(paths.has(p.path), p.path).toBe(true);
  });
});

describe('verify-dist footer rule', () => {
  const page = (links: string[]) => `<html><body>${links.map((l) => `<a href="${l}">x</a>`).join('')}</body></html>`;
  const base = { sitemaps: [], indexedNames: [], unpublishedPaths: new Set<string>() };

  it('fails a page that misses a footer link, and passes one that has them all', () => {
    const complete = page(REQUIRED_FOOTER_PATHS as string[]);
    const missing = page(['/about/']);
    const ok = checkDist({ ...base, pages: new Map([['/a/', complete]]), requiredLinks: REQUIRED_FOOTER_PATHS });
    expect(ok.filter((p) => p.includes('footer'))).toEqual([]);
    const bad = checkDist({ ...base, pages: new Map([['/b/', missing]]), requiredLinks: REQUIRED_FOOTER_PATHS });
    expect(bad.some((p) => p.startsWith('/b/ does not link to') && p.includes('/privacy/'))).toBe(true);
  });
});

describe('pre-launch checklist', () => {
  it('reports what only the owner can supply', () => {
    const items = prelaunchItems();
    expect(items.map((i) => i.label.split(' ')[0])).toEqual(['Governing', 'Legal', 'Reviewers']);
    expect(items.every((i) => typeof i.how === 'string' && i.how.length > 10)).toBe(true);
  });
});
