import type { Category } from './types';

export type LayoutName = 'A' | 'B' | 'C';

/**
 * Layout is decided by category, never at random, so every page in a category shares one structure
 * and the three structures stay clearly different from each other.
 *
 * Plan: A = finance, health. B = math, physics. C = everyday-life, conversion, construction, food,
 * sports, other. The plan does not place statistics, chemistry, biology or ecology, so they are
 * assigned by closeness: statistics and chemistry are formula-led (B); biology and ecology are
 * reference-led (C).
 */
export const LAYOUT_BY_CATEGORY: Record<Category, LayoutName> = {
  finance: 'A',
  health: 'A',
  math: 'B',
  physics: 'B',
  statistics: 'B',
  chemistry: 'B',
  'everyday-life': 'C',
  conversion: 'C',
  construction: 'C',
  food: 'C',
  sports: 'C',
  other: 'C',
  biology: 'C',
  ecology: 'C',
};

/** How the widget arranges itself inside each layout. */
export const WIDGET_VARIANT = { A: 'split', B: 'stack', C: 'compact' } as const satisfies Record<LayoutName, 'split' | 'stack' | 'compact'>;

export const layoutFor = (category: Category): LayoutName => LAYOUT_BY_CATEGORY[category];
