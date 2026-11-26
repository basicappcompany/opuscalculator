import { markdownPath } from './markdown';
import { SITE_URL, absoluteUrl } from './seo';
import type { CalculatorConfig } from './types';

export interface CalculatorIndexEntry {
  slug: string;
  title: string;
  category: string;
  description: string;
  url: string;
  markdown: string;
}

/** /calculators.json: one entry per published calculator. The MCP server treats this list as the only calculators that exist. */
export function calculatorIndex(configs: readonly CalculatorConfig[]): { site: string; count: number; calculators: CalculatorIndexEntry[] } {
  const calculators = [...configs]
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .map((c) => ({
      slug: c.slug,
      title: c.h1,
      category: c.category,
      description: c.metaDescription,
      url: absoluteUrl(`/calculators/${c.slug}/`),
      markdown: absoluteUrl(markdownPath(c.slug)),
    }));
  return { site: SITE_URL, count: calculators.length, calculators };
}
