import { getRenderableHubs, hubPathFor } from './hubs';
import { isPruned } from './pruned';
import { getPublishableCalculators } from './registry';
import { absoluteUrl } from './seo';
import { STATIC_PAGES } from './static-pages';
import type { CalculatorConfig } from './types';

/** Sitemap protocol limit per file. */
export const MAX_URLS_PER_SITEMAP = 50000;

export interface SitemapEntry {
  /** Path such as /calculators/bmi-calculator/. Always absolute-ised with the canonical host on output. */
  path: string;
  lastmod?: string;
  /** Which file family it goes in: "pages", "tier1" or "tier2-finance". */
  group: string;
}

export interface SitemapFile {
  /** File name without the extension, for example "sitemap-tier2-finance". */
  name: string;
  entries: SitemapEntry[];
}

/** Tier 1 calculators share one file; Tier 2 and 3 are split by category (Prompt 6, item 1). */
export const groupOf = (c: Pick<CalculatorConfig, 'tier' | 'category'>): string => (c.tier === 1 ? 'tier1' : `tier${c.tier}-${c.category}`);

/** Throws, naming every offender, if the same path is listed twice. A duplicate in a sitemap is a build failure. */
export function assertNoDuplicatePaths(entries: readonly SitemapEntry[]): void {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const e of entries) (seen.has(e.path) ? dupes : seen).add(e.path);
  if (dupes.size) throw new Error(`Duplicate sitemap URLs: ${[...dupes].join(', ')}`);
}

/** Splits entries into files by group, then into chunks of at most `max` (sitemap-tier1.xml, sitemap-tier1-2.xml, ...). */
export function partition(entries: readonly SitemapEntry[], max = MAX_URLS_PER_SITEMAP): SitemapFile[] {
  assertNoDuplicatePaths(entries);
  const groups = new Map<string, SitemapEntry[]>();
  for (const e of entries) groups.set(e.group, [...(groups.get(e.group) ?? []), e]);
  const files: SitemapFile[] = [];
  for (const [group, list] of [...groups].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const sorted = [...list].sort((a, b) => (a.path < b.path ? -1 : 1));
    for (let i = 0, n = 1; i < sorted.length; i += max, n++) {
      files.push({ name: n === 1 ? `sitemap-${group}` : `sitemap-${group}-${n}`, entries: sorted.slice(i, i + max) });
    }
  }
  return files;
}

const xmlEscape = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function renderSitemap(file: SitemapFile): string {
  const urls = file.entries
    .map((e) => `  <url><loc>${xmlEscape(absoluteUrl(e.path))}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ''}</url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function renderIndex(files: readonly SitemapFile[]): string {
  const items = files.map((f) => `  <sitemap><loc>${xmlEscape(absoluteUrl(`/${f.name}.xml`))}</loc></sitemap>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</sitemapindex>\n`;
}

/**
 * Every URL that may be listed: the home page, the hubs that render, and the published calculators that have not
 * been pruned (a pruned page is noindex, so it must not be in a sitemap).
 * Built from the same registry the page routes use, so a page that does not exist cannot be listed.
 */
export function collectEntries(): SitemapEntry[] {
  return [
    { path: '/', group: 'pages' },
    ...STATIC_PAGES.map((p) => ({ path: p.path, group: 'pages' })),
    ...getRenderableHubs().map((h) => ({ path: hubPathFor(h.category), group: 'pages' })),
    ...getPublishableCalculators()
      .filter((c) => !isPruned(c.slug))
      .map((c) => ({ path: `/calculators/${c.slug}/`, lastmod: c.lastUpdated, group: groupOf(c) })),
  ];
}

export const buildSitemaps = (): SitemapFile[] => partition(collectEntries());
