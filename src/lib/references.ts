/**
 * Methodology and references on every calculator (plan/PROMPT 19, item 20.12). The rules for a reference, and the build
 * check that a published calculator page shows its sources. No network access here: whether a link loads is checked by
 * `npm run refs:check`, because a third-party outage must never be able to fail a deploy.
 */
import type { CalculatorConfig, Reference } from './types';

export const MAX_REFERENCES = 8;
const HOST = 'opuscalculator.com';

const isIsoDate = (s: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
const todayIso = (): string => new Date().toISOString().slice(0, 10);

/** Why one reference is not acceptable. Empty means it is. */
export function referenceProblems(ref: Reference, today: string = todayIso()): string[] {
  const problems: string[] = [];
  if (!ref.title || ref.title.trim().length < 5) problems.push('title is missing or too short');
  if (!ref.publisher || ref.publisher.trim().length < 2) problems.push('publisher is missing');
  if (!ref.supports || ref.supports.trim().length < 10) problems.push('"supports" must say what in the calculator the source backs');
  if (!isIsoDate(ref.accessed ?? '')) problems.push('accessed is not an ISO date (YYYY-MM-DD)');
  else if (ref.accessed > today) problems.push(`accessed (${ref.accessed}) is in the future`);
  try {
    const url = new URL(ref.url);
    if (url.protocol !== 'https:') problems.push('url must be https');
    if (url.hostname === HOST || url.hostname.endsWith(`.${HOST}`)) problems.push('a reference must be an outside source, not this site');
    if (url.username || url.password) problems.push('url must not carry credentials');
    if (/[?&](utm_[a-z]+|fbclid|gclid|ref|token|key|apikey|api_key|session|sid)=/i.test(url.search))
      problems.push('url carries a tracking or secret parameter');
  } catch {
    problems.push('url is not a valid address');
  }
  return problems;
}

/** The quality-gate view of a calculator's references: every problem, prefixed with the reference number. */
export function configReferenceProblems(config: Pick<CalculatorConfig, 'references' | 'assumptions'>, today?: string): string[] {
  const refs = config.references;
  const problems: string[] = [];
  if (refs !== undefined) {
    if (refs.length > MAX_REFERENCES) problems.push(`has ${refs.length} references, at most ${MAX_REFERENCES}`);
    const seen = new Set<string>();
    refs.forEach((ref, i) => {
      for (const p of referenceProblems(ref, today)) problems.push(`reference ${i + 1}: ${p}`);
      const key = ref.url?.replace(/#.*$/, '').replace(/\/$/, '').toLowerCase();
      if (key && seen.has(key)) problems.push(`reference ${i + 1}: the same source is listed twice (${ref.url})`);
      if (key) seen.add(key);
    });
  }
  for (const a of config.assumptions ?? []) if (a.trim().length < 8) problems.push(`an assumption is too short to mean anything: "${a}"`);
  return problems;
}

/**
 * Build check (item 20.12): every published calculator page shows at least one source, except the ones listed as pending,
 * and a pending calculator that has gained sources must come off the list so the list can only shrink.
 */
export function referenceSectionProblems(pages: ReadonlyMap<string, string>, pending: ReadonlySet<string>): string[] {
  const problems: string[] = [];
  for (const [path, html] of pages) {
    if (!path.startsWith('/calculators/') || !path.endsWith('/')) continue;
    const slug = path.slice('/calculators/'.length, -1);
    if (!slug || slug.includes('/')) continue;
    const links = (html.match(/data-reference(?=[\s>])/g) ?? []).length;
    if (links === 0 && !pending.has(slug)) problems.push(`${path} shows no source: add references to ${slug}, or it may not be published (item 20.12)`);
    if (links > 0 && pending.has(slug)) problems.push(`${slug} has sources now: remove it from src/config/references-pending.ts`);
  }
  for (const slug of pending)
    if (!pages.has(`/calculators/${slug}/`)) problems.push(`src/config/references-pending.ts lists ${slug}, which is not a published calculator: remove it`);
  return problems;
}
