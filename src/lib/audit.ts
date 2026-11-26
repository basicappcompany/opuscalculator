/**
 * Pure checks over a built site, used by the build step (scripts/verify-dist.ts) and the link audit
 * (scripts/link-audit.ts). They take page HTML and sitemap contents as plain data so they can be tested
 * without a build.
 */

const HOST = 'https://opuscalculator.com';

/** Normalises an href to a site path with a trailing slash, or null for anything that is not an internal page link. */
export function toPath(href: string, from = '/'): string | null {
  let h = href.trim();
  if (!h || h.startsWith('#') || /^(mailto:|tel:|javascript:|data:)/i.test(h)) return null;
  if (h.startsWith(HOST)) h = h.slice(HOST.length) || '/';
  else if (/^[a-z][a-z0-9+.-]*:/i.test(h) || h.startsWith('//')) return null; // another host
  if (!h.startsWith('/')) h = new URL(h, `${HOST}${from}`).pathname;
  h = h.split('#')[0].split('?')[0];
  if (/\.[a-z0-9]{2,5}$/i.test(h)) return null; // a file (asset, xml, ico), not a page
  return h.endsWith('/') ? h : `${h}/`;
}

/** Distinct internal page paths linked from `<a href>` in an HTML document. */
export function extractLinks(html: string, from = '/'): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/<a\s[^>]*?href\s*=\s*"([^"]*)"/gi)) {
    const p = toPath(m[1].replace(/&amp;/g, '&'), from);
    if (p) out.add(p);
  }
  return [...out];
}

export const hasNoindex = (html: string): boolean => /<meta\s+name="robots"\s+content="[^"]*noindex/i.test(html);

export interface LinkAuditInput {
  /** Built pages: path (with trailing slash) to HTML. */
  pages: ReadonlyMap<string, string>;
  /** Paths listed in any sitemap. */
  sitemapPaths: ReadonlySet<string>;
  /** Pages that exist in the registry but are not published, so nothing may link to them. */
  unpublishedPaths: ReadonlySet<string>;
}

export interface LinkAuditResult {
  inbound: Map<string, string[]>;
  /** Pages (other than the home page) with no inbound internal link. */
  orphans: string[];
  /** Pages with fewer than `minInbound` inbound links, with their count. */
  lowInbound: { path: string; count: number }[];
  /** In a sitemap but not linked from any page. */
  sitemapOnly: string[];
  /** Links to a page that is unpublished, or that does not exist in the build. */
  badLinks: { from: string; to: string; reason: 'unpublished' | 'missing' }[];
}

/** Crawl result from built HTML. A page's inbound links come from other pages only; self links do not count. */
export function auditLinks(input: LinkAuditInput, minInbound = 3): LinkAuditResult {
  const { pages, sitemapPaths, unpublishedPaths } = input;
  const inbound = new Map<string, string[]>([...pages.keys()].map((p) => [p, []]));
  const badLinks: LinkAuditResult['badLinks'] = [];

  for (const [from, html] of pages) {
    for (const to of extractLinks(html, from)) {
      if (to === from) continue;
      if (unpublishedPaths.has(to)) badLinks.push({ from, to, reason: 'unpublished' });
      else if (!pages.has(to)) badLinks.push({ from, to, reason: 'missing' });
      else inbound.get(to)!.push(from);
    }
  }

  const content = [...pages.keys()].filter((p) => p !== '/').sort();
  return {
    inbound,
    orphans: content.filter((p) => inbound.get(p)!.length === 0),
    lowInbound: content.filter((p) => inbound.get(p)!.length < minInbound).map((p) => ({ path: p, count: inbound.get(p)!.length })),
    sitemapOnly: content.filter((p) => sitemapPaths.has(p) && inbound.get(p)!.length === 0),
    badLinks,
  };
}

export interface SitemapFileData {
  name: string;
  /** Paths from the <loc> entries. */
  paths: string[];
}

export interface DistCheckInput {
  pages: ReadonlyMap<string, string>;
  sitemaps: readonly SitemapFileData[];
  /** Names listed in sitemap-index.xml (without the host and the leading slash), for example "sitemap-tier1.xml". */
  indexedNames: readonly string[];
  unpublishedPaths: ReadonlySet<string>;
  maxUrls?: number;
  /** Internal paths every built page must link to (the footer's about, policy and legal pages). */
  requiredLinks?: readonly string[];
}

/**
 * Everything the build must fail on (Prompt 6 item 6 and Prompt 7): a sitemap URL that is unpublished, missing,
 * noindex or duplicated, a built page that is not in any sitemap, a sitemap over 50,000 URLs or missing from the
 * index, and a rendered link to an unpublished or missing page. Returns the problems; empty means pass.
 */
export function checkDist(input: DistCheckInput): string[] {
  const { pages, sitemaps, indexedNames, unpublishedPaths, maxUrls = 50000, requiredLinks = [] } = input;
  const problems: string[] = [];
  const seen = new Map<string, string>();

  for (const file of sitemaps) {
    if (file.paths.length > maxUrls) problems.push(`${file.name} lists ${file.paths.length} URLs, the limit is ${maxUrls}`);
    if (!indexedNames.includes(file.name)) problems.push(`${file.name} is not listed in sitemap-index.xml`);
    for (const path of file.paths) {
      const first = seen.get(path);
      if (first) problems.push(`duplicate sitemap URL ${path} in ${file.name} (already in ${first})`);
      else seen.set(path, file.name);
      if (unpublishedPaths.has(path)) problems.push(`${file.name} lists an unpublished page: ${path}`);
      else if (!pages.has(path)) problems.push(`${file.name} lists ${path}, which was not built`);
      else if (hasNoindex(pages.get(path)!)) problems.push(`${file.name} lists ${path}, which is noindex`);
    }
  }
  for (const name of indexedNames) if (!sitemaps.some((f) => f.name === name)) problems.push(`sitemap-index.xml lists ${name}, which does not exist`);
  // A noindex page (pruned by Prompt 8) is meant to be absent from the sitemaps.
  for (const [path, html] of pages) if (!seen.has(path) && !hasNoindex(html)) problems.push(`built page ${path} is in no sitemap`);

  if (requiredLinks.length) {
    for (const [path, html] of pages) {
      const linked = new Set(extractLinks(html, path));
      const missing = requiredLinks.filter((p) => !linked.has(p));
      if (missing.length) problems.push(`${path} does not link to ${missing.join(', ')} (required in every footer)`);
    }
  }

  const { badLinks } = auditLinks({ pages, sitemapPaths: new Set(seen.keys()), unpublishedPaths });
  for (const b of badLinks) problems.push(`${b.from} links to ${b.reason === 'unpublished' ? 'an unpublished page' : 'a page that was not built'}: ${b.to}`);
  return problems;
}
