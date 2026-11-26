import { isYmyl } from '../content/disclaimers';
import { reviewerFor } from '../content/reviewers';
import type { CalculatorConfig, Category } from './types';
import { reviewInfo } from './ymyl';

/** Canonical origin (CLAUDE.md). Kept here so JSON-LD, which has no access to Astro.site in tests, agrees with astro.config.mjs. */
export const SITE_URL = 'https://opuscalculator.com';
export const SITE_NAME = 'Opus Calculator';

/** The publisher on every page's JSON-LD (Prompt 12, step 6). */
export const PUBLISHER = { '@type': 'Organization', name: SITE_NAME, url: SITE_URL } as const;

export const absoluteUrl = (path: string): string => new URL(path, SITE_URL).href;

/** schema.org applicationCategory values (the list Google documents for software apps). */
export const APPLICATION_CATEGORY: Record<Category, string> = {
  finance: 'FinanceApplication',
  health: 'HealthApplication',
  math: 'EducationalApplication',
  physics: 'EducationalApplication',
  statistics: 'EducationalApplication',
  chemistry: 'EducationalApplication',
  biology: 'EducationalApplication',
  ecology: 'EducationalApplication',
  conversion: 'UtilitiesApplication',
  'everyday-life': 'UtilitiesApplication',
  other: 'UtilitiesApplication',
  construction: 'HomeApplication',
  food: 'LifestyleApplication',
  sports: 'SportsApplication',
};

export interface Crumb {
  label: string;
  /** Path such as /categories/finance/. Leave out for the current page. */
  href?: string;
}

/** Serialises JSON-LD for a script tag. `<` is escaped so no string can close the tag early. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export function breadcrumbList(crumbs: readonly Crumb[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.label,
      // The last crumb is the current page; Google allows it to omit `item`, but giving the URL is harmless.
      ...(c.href ? { item: absoluteUrl(c.href) } : {}),
    })),
  };
}

/**
 * The review markup of a YMYL page. `lastReviewed` and `reviewedBy` are WebPage properties in schema.org (a
 * WebApplication has neither), so they sit on a WebPage node that points at the calculator. `reviewedBy` is left out
 * when the category has no reviewer, and the date then falls back to the calculator's last-updated date.
 */
function reviewNode(config: CalculatorConfig, url: string) {
  const reviewer = reviewerFor(config.category);
  return {
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    url,
    name: config.h1,
    lastReviewed: reviewInfo(config.category, config.lastUpdated).date,
    ...(reviewer
      ? {
          reviewedBy: {
            '@type': 'Person',
            name: reviewer.name,
            hasCredential: reviewer.credentials,
            ...(reviewer.profileUrl ? { url: reviewer.profileUrl } : {}),
          },
        }
      : {}),
    publisher: PUBLISHER,
    mainEntity: { '@id': `${url}#app` },
  };
}

/** WebApplication + FAQPage + BreadcrumbList for one calculator page, as a single @graph. */
export function calculatorJsonLd(config: CalculatorConfig, path: string, crumbs: readonly Crumb[]) {
  const url = absoluteUrl(path);
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        '@id': `${url}#app`,
        name: config.h1,
        description: config.metaDescription,
        url,
        applicationCategory: APPLICATION_CATEGORY[config.category],
        operatingSystem: 'Any',
        browserRequirements: 'Requires JavaScript only for live recalculation; the default result is in the page HTML.',
        isAccessibleForFree: true,
        inLanguage: 'en',
        dateModified: config.lastUpdated,
        publisher: PUBLISHER,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      },
      ...(isYmyl(config.category) ? [reviewNode(config, url)] : []),
      {
        '@type': 'FAQPage',
        '@id': `${url}#faq`,
        mainEntity: config.faq.map((f) => ({
          '@type': 'Question',
          name: f.question,
          acceptedAnswer: { '@type': 'Answer', text: f.answer },
        })),
      },
      { '@id': `${url}#breadcrumb`, ...breadcrumbList(crumbs) },
    ],
  };
}

/**
 * Build-time guard (Prompt 3, item 1): no two published pages may share a title or a meta description.
 * Throws with every offender listed, so a bad generator run fails the build instead of shipping duplicates.
 */
export function assertUniqueMeta(configs: readonly CalculatorConfig[]): void {
  const problems: string[] = [];
  for (const field of ['title', 'metaDescription', 'h1'] as const) {
    const seen = new Map<string, string>();
    for (const c of configs) {
      const key = c[field].trim().toLowerCase();
      const first = seen.get(key);
      if (first) problems.push(`${field} of "${c.slug}" duplicates "${first}": ${c[field]}`);
      else seen.set(key, c.slug);
    }
  }
  if (problems.length) throw new Error(`Duplicate page metadata:\n- ${problems.join('\n- ')}`);
}

/** CollectionPage + ItemList + BreadcrumbList for a category hub. Only published calculators are listed (rule 6). */
export function hubJsonLd(
  hub: { title: string; metaDescription: string; h1: string },
  path: string,
  items: readonly { slug: string; h1: string }[],
  crumbs: readonly Crumb[],
) {
  const url = absoluteUrl(path);
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${url}#page`,
        name: hub.h1,
        description: hub.metaDescription,
        url,
        inLanguage: 'en',
        isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE_URL },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: items.length,
          itemListElement: items.map((c, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: c.h1,
            url: absoluteUrl(`/calculators/${c.slug}/`),
          })),
        },
      },
      { '@id': `${url}#breadcrumb`, ...breadcrumbList(crumbs) },
    ],
  };
}
