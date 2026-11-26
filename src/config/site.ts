/**
 * Facts about the site that legal and about pages state. One place, so a change is one edit.
 *
 * The three mailboxes below are the ones the plan names (Prompts 12 and 18). They must exist before launch:
 * tracked as an owner item in docs/status.html. `legalReviewed` flips to true only when a person with the right
 * qualifications has read the privacy policy, terms and DMCA page for the operator's real jurisdiction.
 */
export const SITE = {
  name: 'Opus Calculator',
  url: 'https://opuscalculator.com',
  email: { general: 'hello@opuscalculator.com', dmca: 'dmca@opuscalculator.com', accessibility: 'access@opuscalculator.com' },
  /** Law that governs the terms. The owner fills this in before launch (npm run prelaunch fails until it is set). */
  jurisdiction: '',
  /** Date the legal texts were last changed. ISO. */
  legalUpdated: '2026-11-23',
  /** Set to true by the owner after a legal read-through. Reported by `npm run prelaunch`. */
  legalReviewed: false,
  accessibilityTarget: 'WCAG 2.2 AA',
  respondWithinBusinessDays: 10,
} as const;
