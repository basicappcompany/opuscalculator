import type { APIRoute } from 'astro';
import { calculatorMarkdown } from '../../lib/markdown';
import { getPublishableCalculators } from '../../lib/registry';
import type { CalculatorConfig } from '../../lib/types';

// A clean markdown copy of every published calculator: the method, the inputs and defaults, the default result, a worked
// example and the FAQ, without the page chrome. Same configs as the page, so it cannot go stale or disagree.
export function getStaticPaths() {
  return getPublishableCalculators().map((config) => ({ params: { slug: config.slug }, props: { config } }));
}

export const GET: APIRoute = ({ props }) =>
  new Response(calculatorMarkdown((props as { config: CalculatorConfig }).config), { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
