/**
 * Every calculator config, keyed by slug, for the MCP tests. Vite-only (import.meta.glob). The Function does NOT use this:
 * building them all at startup is what Cloudflare refused (see src/mcp/core.ts). It is the reference the tests compare against.
 *
 * It deliberately does not import src/lib/registry.ts: that module reads the cohort flags from the environment, which
 * the Function runtime does not have. Which calculators are public comes from /calculators.json, written by the same
 * build as the site (see functions/mcp.ts), so the MCP server can never expose a page the site does not publish.
 */
import type { CalculatorConfig } from '../../src/lib/types';

const calculators = import.meta.glob<{ default: CalculatorConfig }>('../../src/calculators/*.ts', { eager: true });
const generators = import.meta.glob<{ default: () => CalculatorConfig[] }>('../../src/generators/*.ts', { eager: true });

export function buildCatalog(): Map<string, CalculatorConfig> {
  const all = new Map<string, CalculatorConfig>();
  for (const mod of Object.values(calculators)) all.set(mod.default.slug, mod.default);
  for (const mod of Object.values(generators)) for (const config of mod.default()) if (!all.has(config.slug)) all.set(config.slug, config);
  return all;
}
