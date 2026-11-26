import { CATALOG_AUDIT } from '../config/catalog-audit';
import { isCohortPublished } from '../config/rollout';
import { validateAll } from './quality-gate';
import type { CalculatorConfig, Category, Tier } from './types';

export interface Registry {
  /** Every calculator that passed the quality gate, published or not. */
  readonly valid: readonly CalculatorConfig[];
  /** Calculators that failed the gate, with the reasons. They are excluded everywhere. */
  readonly excluded: readonly { slug: string; category: Category; tier: Tier; reasons: string[] }[];
}

/**
 * Pure builder, separate from the file glob so it can be tested directly.
 * - Duplicate slugs throw (a build must never silently pick one).
 * - Gate failures are logged as warnings and the calculator is excluded; the build is never failed by them.
 * - relatedSlugs that point nowhere are warned about but do not exclude the page.
 */
export function buildRegistry(configs: readonly CalculatorConfig[], warn: (message: string) => void = (m) => console.warn(m)): Registry {
  const seen = new Set<string>();
  for (const c of configs) {
    if (seen.has(c.slug)) throw new Error(`Duplicate calculator slug "${c.slug}"`);
    seen.add(c.slug);
  }

  const valid: CalculatorConfig[] = [];
  const excluded: { slug: string; category: Category; tier: Tier; reasons: string[] }[] = [];
  const results = validateAll(configs);
  for (const c of configs) {
    const result = results.get(c)!;
    if (result.pass) valid.push(c);
    else {
      excluded.push({ slug: c.slug, category: c.category, tier: c.tier, reasons: result.reasons });
      warn(
        `[registry] "${c.slug}" excluded by the quality gate: ${result.reasons.slice(0, 3).join('; ')}${result.reasons.length > 3 ? ` (+${result.reasons.length - 3} more)` : ''}`,
      );
    }
  }

  for (const c of valid) {
    const missing = c.relatedSlugs.filter((s) => !seen.has(s));
    if (missing.length) warn(`[registry] "${c.slug}" lists unknown relatedSlugs: ${missing.join(', ')}`);
  }

  return { valid, excluded };
}

const modules = import.meta.glob<{ default: CalculatorConfig }>('../calculators/*.ts', { eager: true });
// Generators (Prompt 5): each src/generators/*.ts default-exports a function returning configs.
const generatorModules = import.meta.glob<{ default: () => CalculatorConfig[] }>('../generators/*.ts', { eager: true });

export const handWritten: readonly CalculatorConfig[] = Object.values(modules).map((m) => m.default);
export const generated: readonly CalculatorConfig[] = Object.values(generatorModules).flatMap((m) => m.default());

/** Attach the catalog-audit flag (if any); the config is otherwise unchanged. */
const withAudit = (c: CalculatorConfig): CalculatorConfig => {
  const audit = CATALOG_AUDIT.get(c.slug);
  return audit ? { ...c, audit } : c;
};

export const registry: Registry = buildRegistry([...handWritten, ...generated].map(withAudit));

const bySlug = new Map(registry.valid.map((c) => [c.slug, c]));

/**
 * The one definition of "live" (CLAUDE.md rules 1, 5 and 6): the config says publish AND the flag for its
 * cohort is on. Cohort N is tier N, which is a working assumption until the build spec exists (open question 12.4).
 */
export const isPublished = (c: CalculatorConfig): boolean => c.publish && isCohortPublished(c.tier);

/** Calculators that may be rendered, linked and put in a sitemap: gate passed AND published (see isPublished). */
export function getPublishableCalculators(tier?: Tier): CalculatorConfig[] {
  return registry.valid.filter((c) => isPublished(c) && (tier === undefined || c.tier === tier));
}

/**
 * Any registered calculator, published or not. Pages must use getPublishableCalculators() for
 * routes and links (CLAUDE.md rule 6); this is for lookups where the slug is already known to be valid.
 */
export function getCalculatorBySlug(slug: string): CalculatorConfig | undefined {
  return bySlug.get(slug);
}

/** Every slug that passed the gate, including unpublished ones. Not for sitemaps or links. */
export function getAllSlugs(): string[] {
  return registry.valid.map((c) => c.slug);
}

/** Published calculators in a category by default (rule 6); pass includeUnpublished for tooling. */
export function getCalculatorsByCategory(category: Category, opts: { includeUnpublished?: boolean } = {}): CalculatorConfig[] {
  return registry.valid.filter((c) => c.category === category && (opts.includeUnpublished || isPublished(c)));
}
