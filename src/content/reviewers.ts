import type { Category } from '../lib/types';

export interface Reviewer {
  name: string;
  /** Real qualifications only. Never invented: an empty map is correct until a real reviewer agrees. */
  credentials: string;
  profileUrl: string;
  /** ISO date the reviewer last signed off the category. */
  reviewedOn: string;
}

/**
 * Reviewer by category (Prompt 12, step 3). Seeded empty on purpose: do not fabricate credentials. While a category has
 * no reviewer the page says so through the editorial policy's "unaudited calculators" section, and the review date
 * falls back to the calculator's own last-updated date.
 */
export const REVIEWERS: Partial<Record<Category, Reviewer>> = {};

export const reviewerFor = (category: Category): Reviewer | undefined => REVIEWERS[category];
