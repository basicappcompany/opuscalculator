import { reviewerFor } from '../content/reviewers';
import type { Category } from './types';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "2026-11-22" becomes "22 November 2026". No timezone maths: the date is used as written. */
export function longDateLabel(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

/**
 * The review date a YMYL page shows: the reviewer's sign-off when the category has a reviewer, otherwise the
 * calculator's own last-updated date (Prompt 12 rules). One function so the visible line and the JSON-LD cannot disagree.
 */
export function reviewInfo(category: Category, lastUpdated: string): { date: string; dateLabel: string } {
  const date = reviewerFor(category)?.reviewedOn ?? lastUpdated;
  return { date, dateLabel: longDateLabel(date) };
}
