import { hash32 } from './gen-utils';
import { HUB_CONTENT, hubPath } from './hubs';
import { CATEGORY_LABELS } from './categories';
import { getCalculatorsByCategory, getPublishableCalculators } from './registry';
import type { CalculatorConfig } from './types';

/** Prompt 7: what one published calculator page links to. Every entry is a published page (CLAUDE.md rule 6). */
export interface LinkSet {
  /** Parent category hub, only if that hub renders. */
  hub?: { href: string; label: string };
  /** Label of the sub-cluster the siblings come from, for the heading. */
  clusterLabel?: string;
  siblings: CalculatorConfig[];
  /** Published calculators in other categories that share inputs, or are named in relatedSlugs. */
  cross: CalculatorConfig[];
  /** The category's Tier 1 calculator(s): the page that anchors the cluster. */
  start: CalculatorConfig[];
  /**
   * Filler: other published calculators, only when the groups above add up to fewer than MIN_LINKED. At launch
   * only 5 pages are live, so most pages would otherwise link to little more than their hub (open question 12.5).
   */
  more: CalculatorConfig[];
}

/** Siblings wanted per page, and the minimum Prompt 7 asks for. With fewer pages published than that, we link to what exists. */
export const SIBLINGS_WANTED = 6;
export const SIBLINGS_MIN = 3;
export const CROSS_WANTED = 3;
/** A page should link to at least this many other calculators when that many are published. */
export const MIN_LINKED = 4;

/** Input names that every converter-style page has; sharing one says nothing about relatedness. */
const GENERIC_INPUTS = new Set(['value']);

const titleCase = (key: string): string => {
  const text = key.replace(/-/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/** Sub-cluster of a calculator: its own `subCluster`, else the cluster the category's hub copy puts it in. */
export function subClusterOf(config: CalculatorConfig): string | undefined {
  if (config.subCluster) return titleCase(config.subCluster);
  return HUB_CONTENT.get(config.category)?.subclusters.find((s) => s.slugs.includes(config.slug))?.label;
}

const sharedInputs = (a: CalculatorConfig, b: CalculatorConfig): number =>
  a.inputs.filter((i) => !GENERIC_INPUTS.has(i.name) && b.inputs.some((j) => j.name === i.name)).length;

/**
 * relatedSlugs first (the author's choice), then everything else in an order that depends on the pair of pages
 * (a stable hash), not on the alphabet: otherwise the pages that sort first collect most of the inbound links.
 * The same build always produces the same links.
 */
function ranked(config: CalculatorConfig, pool: CalculatorConfig[]): CalculatorConfig[] {
  const order = new Map(config.relatedSlugs.map((s, i) => [s, i]));
  const tie = (c: CalculatorConfig) => hash32(`${config.slug}|${c.slug}`);
  // A page that names this one in its own relatedSlugs is related too: links are made two-way, which also gives a
  // page its inbound links from the pages it was written to point at (a lone page nobody else names would have none).
  const rank = (c: CalculatorConfig) => order.get(c.slug) ?? (c.relatedSlugs.includes(config.slug) ? 1000 : 1e9);
  return [...pool].sort((a, b) => rank(a) - rank(b) || tie(a) - tie(b));
}

export function linksFor(config: CalculatorConfig): LinkSet {
  const hrefOfHub = hubPath(config.category);
  const sameCategory = getCalculatorsByCategory(config.category).filter((c) => c.slug !== config.slug);
  const cluster = subClusterOf(config);

  // The category's Tier 1 anchor(s). A Tier 1 page does not need to point at itself.
  const start = sameCategory
    .filter((c) => c.tier === 1)
    .sort((a, b) => (a.slug < b.slug ? -1 : 1))
    .slice(0, 2);
  const startSlugs = new Set(start.map((c) => c.slug));

  // Siblings: same sub-cluster first, then (while fewer than the minimum exist) the rest of the category.
  const inCluster = cluster ? sameCategory.filter((c) => subClusterOf(c) === cluster && !startSlugs.has(c.slug)) : [];
  let siblings = ranked(config, inCluster).slice(0, SIBLINGS_WANTED);
  if (siblings.length < SIBLINGS_MIN) {
    const used = new Set(siblings.map((c) => c.slug));
    const topUp = ranked(
      config,
      sameCategory.filter((c) => !used.has(c.slug) && !startSlugs.has(c.slug)),
    );
    siblings = [...siblings, ...topUp].slice(0, Math.max(SIBLINGS_MIN, siblings.length));
  }

  // Cross-category: share input names (weight and height link BMI to body fat) or are named in relatedSlugs.
  const named = new Set(config.relatedSlugs);
  const cross = getPublishableCalculators()
    .filter((c) => c.category !== config.category)
    .map((c) => ({ c, score: sharedInputs(config, c) * 10 + (named.has(c.slug) ? 5 : 0) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || (a.c.slug < b.c.slug ? -1 : 1))
    .slice(0, CROSS_WANTED)
    .map((x) => x.c);

  const linked = new Set([config.slug, ...start.map((c) => c.slug), ...siblings.map((c) => c.slug), ...cross.map((c) => c.slug)]);
  const fillCount = Math.max(0, MIN_LINKED - (linked.size - 1));
  const more = fillCount
    ? ranked(
        config,
        getPublishableCalculators().filter((c) => !linked.has(c.slug)),
      ).slice(0, fillCount)
    : [];

  return {
    hub: hrefOfHub ? { href: hrefOfHub, label: `All ${CATEGORY_LABELS[config.category].toLowerCase()} calculators` } : undefined,
    clusterLabel: cluster,
    siblings,
    cross,
    start,
    more,
  };
}

/** Every calculator a LinkSet points at, for tests and the audit. */
export const linkedCalculators = (links: LinkSet): CalculatorConfig[] => [...links.siblings, ...links.cross, ...links.start, ...links.more];
