import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { auditLinks, checkDist, extractLinks, toPath } from '../src/lib/audit';
import {
  MAX_URLS_PER_SITEMAP,
  assertNoDuplicatePaths,
  buildSitemaps,
  collectEntries,
  groupOf,
  partition,
  renderIndex,
  renderSitemap,
} from '../src/lib/sitemaps';
import { getPublishableCalculators } from '../src/lib/registry';

const page = (...hrefs: string[]) => `<html><body>${hrefs.map((h) => `<a href="${h}">x</a>`).join('')}</body></html>`;

describe('toPath and extractLinks', () => {
  it('normalises internal links and drops everything else', () => {
    expect(toPath('/calculators/bmi-calculator')).toBe('/calculators/bmi-calculator/');
    expect(toPath('https://opuscalculator.com/categories/health/#top')).toBe('/categories/health/');
    expect(toPath('/a/?sort=x')).toBe('/a/');
    expect(toPath('https://example.com/x')).toBeNull();
    expect(toPath('//cdn.example.com/x')).toBeNull();
    expect(toPath('mailto:hello@opuscalculator.com')).toBeNull();
    expect(toPath('#main')).toBeNull();
    expect(toPath('/favicon.svg')).toBeNull();
    expect(toPath('/sitemap-index.xml')).toBeNull();
  });

  it('reads only anchors, once each', () => {
    const html = '<link rel="canonical" href="https://opuscalculator.com/x/"><a href="/a/">1</a><a href="/a/">2</a><a class="k" href="/b/">3</a>';
    expect(extractLinks(html).sort()).toEqual(['/a/', '/b/']);
  });
});

describe('auditLinks', () => {
  const pages = new Map([
    ['/', page('/a/', '/b/')],
    ['/a/', page('/', '/b/', '/c/')],
    ['/b/', page('/', '/a/')],
    ['/c/', page('/', '/b/', '/hidden/', '/ghost/')],
    ['/orphan/', page('/')],
  ]);
  const r = auditLinks({ pages, sitemapPaths: new Set(['/a/', '/orphan/']), unpublishedPaths: new Set(['/hidden/']) });

  it('finds orphans and sitemap-only pages', () => {
    expect(r.orphans).toEqual(['/orphan/']);
    expect(r.sitemapOnly).toEqual(['/orphan/']);
  });

  it('counts inbound links from other pages only, and reports pages under 3', () => {
    expect(r.inbound.get('/b/')!.sort()).toEqual(['/', '/a/', '/c/']);
    expect(r.lowInbound.find((x) => x.path === '/b/')).toBeUndefined();
    expect(r.lowInbound.find((x) => x.path === '/a/')).toEqual({ path: '/a/', count: 2 });
  });

  it('reports links to unpublished and to missing pages', () => {
    expect(r.badLinks).toEqual([
      { from: '/c/', to: '/hidden/', reason: 'unpublished' },
      { from: '/c/', to: '/ghost/', reason: 'missing' },
    ]);
  });
});

describe('checkDist (the build step)', () => {
  const pages = new Map([
    ['/', page('/a/')],
    ['/a/', page('/')],
  ]);
  const ok = { pages, sitemaps: [{ name: 'sitemap-pages.xml', paths: ['/', '/a/'] }], indexedNames: ['sitemap-pages.xml'], unpublishedPaths: new Set(['/x/']) };

  it('passes a consistent site', () => {
    expect(checkDist(ok)).toEqual([]);
  });

  it('fails on an unpublished URL in a sitemap', () => {
    const bad = { ...ok, sitemaps: [{ name: 'sitemap-pages.xml', paths: ['/', '/a/', '/x/'] }] };
    expect(checkDist(bad).join()).toMatch(/lists an unpublished page: \/x\//);
  });

  it('fails on a duplicate URL, across two files too', () => {
    const bad = {
      ...ok,
      sitemaps: [
        { name: 'sitemap-pages.xml', paths: ['/', '/a/'] },
        { name: 'sitemap-tier1.xml', paths: ['/a/'] },
      ],
      indexedNames: ['sitemap-pages.xml', 'sitemap-tier1.xml'],
    };
    expect(checkDist(bad).join()).toMatch(/duplicate sitemap URL \/a\//);
  });

  it('fails on a URL that was not built, a built page in no sitemap, an unindexed file and a noindex page', () => {
    expect(checkDist({ ...ok, sitemaps: [{ name: 'sitemap-pages.xml', paths: ['/', '/a/', '/ghost/'] }] }).join()).toMatch(/\/ghost\/, which was not built/);
    expect(checkDist({ ...ok, sitemaps: [{ name: 'sitemap-pages.xml', paths: ['/'] }] }).join()).toMatch(/built page \/a\/ is in no sitemap/);
    expect(checkDist({ ...ok, indexedNames: [] }).join()).toMatch(/not listed in sitemap-index/);
    const noindex = new Map([
      ['/', page('/a/')],
      ['/a/', '<meta name="robots" content="noindex, follow">' + page('/')],
    ]);
    expect(checkDist({ ...ok, pages: noindex }).join()).toMatch(/\/a\/, which is noindex/);
  });

  it('fails on a rendered link to an unpublished page, and on a file over the URL limit', () => {
    const linky = new Map([
      ['/', page('/a/', '/x/')],
      ['/a/', page('/')],
    ]);
    expect(checkDist({ ...ok, pages: linky }).join()).toMatch(/links to an unpublished page: \/x\//);
    expect(checkDist({ ...ok, maxUrls: 1 }).join()).toMatch(/lists 2 URLs, the limit is 1/);
  });
});

describe('sitemap partitioning', () => {
  const entries = [
    { path: '/', group: 'pages' },
    { path: '/calculators/a/', group: 'tier1' },
    { path: '/calculators/b/', group: 'tier2-finance' },
    { path: '/calculators/c/', group: 'tier2-health' },
  ];

  it('one file per group, named sitemap-<group>', () => {
    expect(partition(entries).map((f) => f.name)).toEqual(['sitemap-pages', 'sitemap-tier1', 'sitemap-tier2-finance', 'sitemap-tier2-health']);
  });

  it('splits a group at the limit', () => {
    const many = Array.from({ length: 5 }, (_, i) => ({ path: `/calculators/p${i}/`, group: 'tier3-conversion' }));
    expect(partition(many, 2).map((f) => [f.name, f.entries.length])).toEqual([
      ['sitemap-tier3-conversion', 2],
      ['sitemap-tier3-conversion-2', 2],
      ['sitemap-tier3-conversion-3', 1],
    ]);
    expect(MAX_URLS_PER_SITEMAP).toBe(50000);
  });

  it('refuses duplicates', () => {
    expect(() => assertNoDuplicatePaths([...entries, { path: '/', group: 'pages' }])).toThrow(/Duplicate sitemap URLs: \//);
  });

  it('groups: Tier 1 together, Tier 2 and 3 by category', () => {
    expect(groupOf({ tier: 1, category: 'finance' })).toBe('tier1');
    expect(groupOf({ tier: 2, category: 'finance' })).toBe('tier2-finance');
    expect(groupOf({ tier: 3, category: 'conversion' })).toBe('tier3-conversion');
  });

  it('renders XML on the canonical host, escaped, and an index', () => {
    const xml = renderSitemap({ name: 'sitemap-tier1', entries: [{ path: '/calculators/a&b/', lastmod: '2026-11-22', group: 'tier1' }] });
    expect(xml).toContain('<loc>https://opuscalculator.com/calculators/a&amp;b/</loc><lastmod>2026-11-22</lastmod>');
    expect(renderIndex([{ name: 'sitemap-tier1', entries: [] }])).toContain('<loc>https://opuscalculator.com/sitemap-tier1.xml</loc>');
  });
});

describe('the real sitemaps', () => {
  it('contain exactly the home page, the rendered hubs and the published calculators', () => {
    const paths = buildSitemaps().flatMap((f) => f.entries.map((e) => e.path));
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths.filter((p) => p.startsWith('/calculators/')).sort()).toEqual(
      getPublishableCalculators()
        .map((c) => `/calculators/${c.slug}/`)
        .sort(),
    );
    expect(paths).toContain('/');
    expect(collectEntries().length).toBe(paths.length);
  });
});

describe('robots.txt', () => {
  // git on Windows checks files out with CRLF line endings
  const robots = readFileSync('public/robots.txt', 'utf8').split(/\r?\n/).join('\n');

  it('allows the six named crawlers and lists the sitemap index', () => {
    for (const bot of ['Googlebot', 'Bingbot', 'GPTBot', 'ClaudeBot', 'PerplexityBot', 'OAI-SearchBot'])
      expect(robots).toMatch(new RegExp(`User-agent: ${bot}\\nAllow: /`));
    expect(robots).toContain('Sitemap: https://opuscalculator.com/sitemap-index.xml');
  });

  it('disallows the facet parameters in every group and does not block CSS or JavaScript', () => {
    const groups = robots.split(/\n\n/).filter((g) => g.startsWith('User-agent'));
    expect(groups.length).toBe(7);
    for (const g of groups) for (const p of ['?sort=', '?filter=', '?page=']) expect(g).toContain(`Disallow: /*${p}`);
    expect(robots).not.toMatch(/Disallow:\s*\/(_astro|.*\.css|.*\.js)/);
  });
});
