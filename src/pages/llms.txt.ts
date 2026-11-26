import type { APIRoute } from 'astro';
import { llmsTxt } from '../lib/markdown';
import { getPublishableCalculators } from '../lib/registry';
import { absoluteUrl } from '../lib/seo';

// What the site is and one line per published calculator, for AI assistants and agents (plan/PROMPT 19).
// Published calculators only (CLAUDE.md rule 6), so switching a cohort on adds its pages here in the same build.
export const GET: APIRoute = () =>
  new Response(llmsTxt(getPublishableCalculators(), { mcpUrl: absoluteUrl('/mcp') }), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
