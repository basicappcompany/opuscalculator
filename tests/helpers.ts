import { runWith } from '../src/lib/calc-utils';
import type { CalculatorConfig } from '../src/lib/types';

/** Calculate with the defaults, overriding only what a test names. */
export const runner =
  (config: CalculatorConfig) =>
  (overrides: Record<string, unknown> = {}) =>
    runWith(config, overrides);
