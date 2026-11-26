/**
 * Build checks for the AI-readable layer (plan/PROMPT 19, items 20.6 and 20.8). Pure functions over built output, run by
 * scripts/verify-dist.ts and covered by tests/ai-discovery.test.ts.
 */
import { markdownPath } from './markdown';

const NAMED: Record<string, string> = { '&quot;': '"', '&lt;': '<', '&gt;': '>', '&amp;': '&', '&apos;': "'" };

const decodeEntities = (s: string): string =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&(quot|lt|gt|amp|apos);/g, (m) => NAMED[m] ?? m);

/** The text a reader sees on a page: no scripts or styles, no tags, entities decoded, whitespace collapsed. */
export function visibleText(html: string): string {
  return decodeEntities(html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

const collapse = (s: string): string => s.replace(/\s+/g, ' ').trim();

/** The JSON-LD objects in a page. */
export function jsonLdBlocks(html: string): unknown[] {
  const out: unknown[] = [];
  for (const m of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      out.push(JSON.parse(m[1]));
    } catch {
      out.push(null);
    }
  }
  return out;
}

type Node = { '@type'?: string; name?: string; text?: string; hasPart?: Node[]; '@graph'?: Node[] };

/** Every WebPageElement (the formula and the worked example) in a page's JSON-LD. */
function structuredParts(html: string): Node[] {
  const parts: Node[] = [];
  for (const block of jsonLdBlocks(html) as Node[]) {
    for (const node of block?.['@graph'] ?? []) for (const part of node.hasPart ?? []) if (part['@type'] === 'WebPageElement') parts.push(part);
  }
  return parts;
}

/** Item 20.8: the text in the structured answers must be text the page shows (what an answer engine quotes is what a reader sees). */
export function structuredAnswerProblems(pages: ReadonlyMap<string, string>): string[] {
  const problems: string[] = [];
  for (const [path, html] of pages) {
    if (!path.startsWith('/calculators/')) continue;
    const parts = structuredParts(html);
    if (parts.length === 0) {
      problems.push(`${path} has no structured formula and worked-example answers in its JSON-LD`);
      continue;
    }
    const visible = visibleText(html);
    for (const part of parts) {
      if (!part.text || !visible.includes(collapse(part.text))) problems.push(`${path}: the JSON-LD "${part.name ?? 'part'}" text is not on the page`);
    }
  }
  return problems;
}

export interface AiFiles {
  /** Contents of dist/llms.txt, or undefined when the file is missing. */
  llms: string | undefined;
  /** Slugs that have a dist/calculators/<slug>.md. */
  markdownSlugs: ReadonlySet<string>;
}

const slugOf = (path: string): string | null => {
  if (!path.startsWith('/calculators/') || !path.endsWith('/')) return null;
  const slug = path.slice('/calculators/'.length, -1);
  return slug && !slug.includes('/') ? slug : null;
};

/**
 * Item 20.6: /llms.txt lists exactly the published calculators (CLAUDE.md rule 6), each with a markdown copy, and every
 * published calculator's page points at that copy.
 */
export function aiDiscoveryProblems(pages: ReadonlyMap<string, string>, files: AiFiles, host = 'https://opuscalculator.com'): string[] {
  const problems: string[] = [];
  const published = new Set<string>();
  for (const path of pages.keys()) {
    const slug = slugOf(path);
    if (slug) published.add(slug);
  }
  if (files.llms === undefined) return ['dist/llms.txt is missing'];

  const listed = new Set<string>();
  for (const m of files.llms.matchAll(/\]\(([^)]+)\)/g)) {
    const url = m[1];
    if (!url.startsWith(`${host}/calculators/`) || !url.endsWith('.md')) continue;
    listed.add(url.slice(`${host}/calculators/`.length, -'.md'.length));
  }
  for (const slug of listed) if (!published.has(slug)) problems.push(`llms.txt lists ${slug}, which is not a published calculator`);
  for (const slug of published) {
    if (!listed.has(slug)) problems.push(`llms.txt does not list the published calculator ${slug}`);
    if (!files.markdownSlugs.has(slug)) problems.push(`${slug} has no markdown copy (${markdownPath(slug)})`);
    const html = pages.get(`/calculators/${slug}/`) ?? '';
    if (!html.includes(`rel="alternate" type="text/markdown" href="${markdownPath(slug)}"`))
      problems.push(`/calculators/${slug}/ does not link its markdown copy`);
  }
  for (const slug of files.markdownSlugs) if (!published.has(slug)) problems.push(`${markdownPath(slug)} exists but ${slug} is not a published calculator`);
  return problems;
}
