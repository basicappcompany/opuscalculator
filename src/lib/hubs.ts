import type { HubContent } from '../content/categories/types';
import { getCalculatorsByCategory } from './registry';
import type { Category } from './types';

export const HUB_MIN_WORDS = 800;
export const HUB_MAX_WORDS = 1200;

const modules = import.meta.glob<{ default: HubContent }>('../content/categories/*.ts', { eager: true });

/** All hub copy, keyed by category. `types.ts` has no default export, so it is skipped. */
export const HUB_CONTENT: ReadonlyMap<Category, HubContent> = new Map(
  Object.values(modules)
    .filter((m) => m.default)
    .map((m) => [m.default.category, m.default]),
);

export const wordsIn = (text: string): number => text.split(/\s+/).filter(Boolean).length;

/** Words of analysis: the lede plus every paragraph. Headings, calculator blurbs and the decision guide do not count. */
export function hubWordCount(hub: HubContent): number {
  return wordsIn(hub.lede) + hub.sections.reduce((n, s) => n + s.paragraphs.reduce((m, p) => m + wordsIn(p), 0), 0);
}

/**
 * Which hubs render. A hub needs at least one published calculator to list (rule 6, and an empty hub is thin
 * content) AND at least HUB_MIN_WORDS of analysis. A hub that has calculators but too few words is a content
 * bug, so it throws and fails the build rather than silently dropping a page other pages may link to.
 */
export function selectRenderableHubs(hubs: Iterable<HubContent>, publishedCount: (category: Category) => number): HubContent[] {
  const out: HubContent[] = [];
  for (const hub of hubs) {
    if (publishedCount(hub.category) === 0) continue;
    const words = hubWordCount(hub);
    if (words < HUB_MIN_WORDS) {
      throw new Error(`Hub "${hub.category}" has ${words} words; a hub needs at least ${HUB_MIN_WORDS} before it can render.`);
    }
    out.push(hub);
  }
  return out;
}

const publishedCount = (category: Category): number => getCalculatorsByCategory(category).length;

export const getRenderableHubs = (): HubContent[] => selectRenderableHubs(HUB_CONTENT.values(), publishedCount);

/** Path of a category's hub if it renders, otherwise undefined. Anything that links to a hub must go through this. */
export function hubPath(category: Category): string | undefined {
  const hub = HUB_CONTENT.get(category);
  if (!hub || publishedCount(category) === 0) return undefined;
  return hubPathFor(category);
}

export const hubPathFor = (category: Category): string => `/categories/${category}/`;
