/**
 * Cohort rollout flags. Defaults: only Cohort 1 is published.
 *
 * THE PROMOTION GATE IS ENFORCED HERE (CLAUDE.md rule 5, Appendix B). Cohort 2 may only be switched on once Cohort 1
 * indexation is above 40% AND at least 20% of Cohort 1 pages have organic clicks; the same for Cohort 3 against
 * Cohort 2. Setting COHORT_2_PUBLISHED or COHORT_3_PUBLISHED to true makes this module throw, and so fails the build,
 * unless `src/config/promotion-gate.json` (written by `npm run gate` from a real indexation.csv, at most 14 days old)
 * says the promotion is allowed. Nobody has to remember the rule: the build refuses.
 *
 * Local escape hatch for test builds only: PROMOTION_GATE_SKIP=local-only. It is ignored when CI or CF_PAGES is set,
 * so it cannot ship a promotion from CI or from Cloudflare Pages. Vitest skips the check because tests are not builds.
 */
import { EMPTY_GATE, checkPromotion, type GateFile } from '../lib/indexation';
import gateFile from './promotion-gate.json';

const read = (name: string): string | undefined => (import.meta.env?.[name] ?? process.env[name]) as string | undefined;

const flag = (name: string, fallback: boolean): boolean => {
  const raw = read(name);
  if (raw === undefined || raw === '') return fallback;
  return raw.trim().toLowerCase() === 'true';
};

export const rollout = {
  1: flag('COHORT_1_PUBLISHED', true),
  2: flag('COHORT_2_PUBLISHED', false),
  3: flag('COHORT_3_PUBLISHED', false),
} as const;

export type Cohort = 1 | 2 | 3;

export const isCohortPublished = (cohort: Cohort): boolean => rollout[cohort];

const skipGate = Boolean(process.env.VITEST) || (read('PROMOTION_GATE_SKIP') === 'local-only' && !read('CF_PAGES') && !read('CI'));
if (!skipGate) {
  const problems = checkPromotion(rollout, (gateFile as unknown as GateFile) ?? EMPTY_GATE, Date.now());
  if (problems.length) {
    throw new Error(`Promotion gate: ${problems.join(' | ')}\nSee CLAUDE.md rule 5 and Appendix B. Do not promote on a hunch.`);
  }
}
