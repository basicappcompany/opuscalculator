import type { CalculatorConfig } from './types';

/**
 * Browser-side loader. `import.meta.glob` without `eager` makes one lazy chunk per calculator, so a
 * page downloads only its own calculate() and validators, never the whole catalogue. Do not import
 * the registry from client code: it pulls in every calculator.
 */
const loaders = import.meta.glob<{ default: CalculatorConfig }>('../calculators/*.ts');

export async function loadCalculatorConfig(slug: string): Promise<CalculatorConfig> {
  const load = loaders[`../calculators/${slug}.ts`];
  if (!load) throw new Error(`No calculator file for slug "${slug}"`);
  return (await load()).default;
}
