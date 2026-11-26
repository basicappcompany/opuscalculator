/**
 * The runtime of the MCP bundle: it holds a loader for each published calculator and nothing else, so the Function starts
 * in a few milliseconds instead of building every calculator (the first version did, and Cloudflare refused it with
 * "Script startup exceeded CPU time limit"). A calculator's config is built the first time someone asks for it and kept for
 * the life of the isolate.
 *
 * scripts/build-mcp.ts writes the loaders for the calculators published in this build; this file is shared by that
 * generated entry and the tests.
 */
import type { CalculatorIndexEntry } from '../lib/calculator-index';
import type { CalculatorConfig } from '../lib/types';
import { MAX_BODY_BYTES, SERVER_INFO, handleMcpMessage } from './protocol';

export type Loader = () => Promise<CalculatorConfig | undefined>;

export { MAX_BODY_BYTES, SERVER_INFO };

// A generator file builds every calculator it owns in one call, so run it once per file and look the slug up in the result.
const generatorRuns = new Map<string, Promise<CalculatorConfig[]>>();

/** Loader for a calculator that comes from a generator file (src/generators/<file>.ts). */
export function fromGenerator(file: string, importer: () => Promise<{ default: () => CalculatorConfig[] }>, slug: string): Loader {
  return async () => {
    let run = generatorRuns.get(file);
    if (!run) {
      run = importer().then((m) => m.default());
      generatorRuns.set(file, run);
    }
    return (await run).find((c) => c.slug === slug);
  };
}

/** Loader for a hand-written calculator (src/calculators/<slug>.ts). */
export const fromModule =
  (importer: () => Promise<{ default: CalculatorConfig }>): Loader =>
  async () =>
    (await importer()).default;

export function createCore(loaders: Readonly<Record<string, Loader>>) {
  const cache = new Map<string, Promise<CalculatorConfig | undefined>>();
  const load = (slug: string): Promise<CalculatorConfig | undefined> => {
    let config = cache.get(slug);
    if (!config) {
      const loader = Object.hasOwn(loaders, slug) ? loaders[slug] : undefined;
      config = loader ? loader() : Promise.resolve(undefined);
      cache.set(slug, config);
    }
    return config;
  };
  return {
    /** How many calculators this bundle can run. */
    count: Object.keys(loaders).length,
    /** `index` is /calculators.json: the calculators the site publishes. */
    handleMcp: (message: unknown, index: ReadonlyMap<string, CalculatorIndexEntry>) => handleMcpMessage(message, { index, load }),
  };
}
