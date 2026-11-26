import type { APIRoute } from 'astro';
import { calculatorIndex } from '../lib/calculator-index';
import { getPublishableCalculators } from '../lib/registry';

// A small machine-readable index of every published calculator, for agents and for the MCP server (plan/PROMPT 19).
// Published only (CLAUDE.md rule 6): the MCP Function reads this file to know which calculators exist.
export const GET: APIRoute = () =>
  new Response(JSON.stringify(calculatorIndex(getPublishableCalculators()), null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
