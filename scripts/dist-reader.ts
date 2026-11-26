import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { hubPathFor } from '../src/lib/hubs';
import { registry, isPublished } from '../src/lib/registry';
import { CATEGORIES } from '../src/lib/types';
import { getRenderableHubs } from '../src/lib/hubs';
import type { SitemapFileData } from '../src/lib/audit';

export const DIST = join(process.cwd(), 'dist');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/** Every built page: its path with a trailing slash, and its HTML. Only index.html files count as pages. */
export function readPages(): Map<string, string> {
  if (!existsSync(DIST)) throw new Error('dist/ does not exist; run `npm run build` first');
  const pages = new Map<string, string>();
  for (const file of walk(DIST)) {
    if (!file.endsWith(`${sep}index.html`)) continue;
    const rel = relative(DIST, file).split(sep).slice(0, -1).join('/');
    pages.set(rel ? `/${rel}/` : '/', readFileSync(file, 'utf8'));
  }
  return pages;
}

const locs = (xml: string): string[] => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, '&'));
const pathOf = (url: string): string => new URL(url).pathname;

/** The sitemap files in dist/ and the names the index lists. */
export function readSitemaps(): { files: SitemapFileData[]; indexedNames: string[] } {
  const indexFile = join(DIST, 'sitemap-index.xml');
  if (!existsSync(indexFile)) throw new Error('dist/sitemap-index.xml is missing');
  const indexedNames = locs(readFileSync(indexFile, 'utf8')).map((u) => pathOf(u).replace(/^\//, ''));
  const files = readdirSync(DIST)
    .filter((n) => /^sitemap-.+\.xml$/.test(n) && n !== 'sitemap-index.xml')
    .map((n) => ({ name: n, paths: locs(readFileSync(join(DIST, n), 'utf8')).map(pathOf) }));
  return { files, indexedNames };
}

/** Pages that exist in the registry (or would, with a hub) but are not live: nothing may link to or list them. */
export function unpublishedPaths(): Set<string> {
  const out = new Set<string>();
  for (const c of registry.valid) if (!isPublished(c)) out.add(`/calculators/${c.slug}/`);
  for (const e of registry.excluded) out.add(`/calculators/${e.slug}/`);
  const rendered = new Set(getRenderableHubs().map((h) => h.category));
  for (const category of CATEGORIES) if (!rendered.has(category)) out.add(hubPathFor(category));
  return out;
}
