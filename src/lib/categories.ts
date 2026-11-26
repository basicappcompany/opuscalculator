import type { Category } from './types';

/** Decorative icon for category cards (always aria-hidden where shown). */
export const CATEGORY_ICONS: Record<Category, string> = {
  math: '➗',
  finance: '💰',
  physics: '⚡',
  health: '🩺',
  conversion: '📐',
  'everyday-life': '🏠',
  statistics: '📊',
  construction: '🧱',
  biology: '🧬',
  sports: '🏅',
  chemistry: '⚗️',
  food: '🍳',
  ecology: '🌱',
  other: '✨',
};

export const CATEGORY_LABELS: Record<Category, string> = {
  math: 'Math',
  finance: 'Finance',
  physics: 'Physics',
  health: 'Health',
  conversion: 'Conversion',
  'everyday-life': 'Everyday life',
  statistics: 'Statistics',
  construction: 'Construction',
  biology: 'Biology',
  sports: 'Sports',
  chemistry: 'Chemistry',
  food: 'Food',
  ecology: 'Ecology',
  other: 'Other',
};
