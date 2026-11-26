/**
 * Published calculators that do not show sources yet (plan/PROMPT 19, item 20.12). These five went live on 27 Nov 2026,
 * before references existed. Every other calculator needs at least one verified reference before it may be published:
 * `verify-dist` fails the build for a published calculator page with no source that is not on this list.
 *
 * The list can only shrink. When a calculator on it gains references, delete its line (the build fails until you do).
 * When the list is empty, delete the file and the check that reads it.
 */
export const REFERENCES_PENDING: ReadonlySet<string> = new Set([
  'age-calculator',
  'bmi-calculator',
  'compound-interest-calculator',
  'mortgage-calculator',
  'percentage-calculator',
]);
