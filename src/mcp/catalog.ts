/**
 * Every calculator config, keyed by slug, for the MCP server. Vite-only (import.meta.glob): it is bundled into the
 * Pages Function by scripts/build-mcp.ts, and read directly by the tests.
 *
 * It deliberately does not import src/lib/registry.ts: that module reads the cohort flags from the environment, which
 * the Function runtime does not have. Which calculators are public comes from /calculators.json, written by the same
 * build as the site (see functions/mcp.ts), so the MCP server can never expose a page the site does not publish.
 */
import type { CalculatorConfig } from '../lib/types';

const calculators = import.meta.glob<{ default: CalculatorConfig }>('../calculators/*.ts', { eager: true });
const generators = import.meta.glob<{ default: () => CalculatorConfig[] }>('../generators/*.ts', { eager: true });

export function buildCatalog(): Map<string, CalculatorConfig> {
  const all = new Map<string, CalculatorConfig>();
  for (const mod of Object.values(calculators)) all.set(mod.default.slug, mod.default);
  for (const mod of Object.values(generators)) for (const config of mod.default()) if (!all.has(config.slug)) all.set(config.slug, config);
  return all;
}
