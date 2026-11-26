/**
 * Published calculators that do not show sources yet (plan/PROMPT 19, item 20.12). The five that went live on 27 Nov 2026 before
 * references existed (age, BMI, compound interest, mortgage, percentage) were all given verified sources the same day, so this set is
 * now empty. Every other calculator needs at least one verified reference before it may be published:
 * `verify-dist` fails the build for a published calculator page with no source that is not on this list.
 *
 * The list can only shrink. When a calculator on it gains references, delete its line (the build fails until you do).
 * The set is kept (empty) so a future grandfathering is possible without new code; delete it if it is never needed again.
 */
export const REFERENCES_PENDING: ReadonlySet<string> = new Set<string>();
