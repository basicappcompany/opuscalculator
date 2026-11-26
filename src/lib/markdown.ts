/**
 * Machine-readable renderings of the site (plan/PROMPT 19, "AI-era discovery"): a clean markdown copy of each published
 * calculator and the site's /llms.txt. Pure functions over the same configs the pages use, so a page, its markdown and
 * the MCP server can never disagree. Published calculators only (CLAUDE.md rule 6).
 */
import { disclaimerFor } from '../content/disclaimers';
import { CATEGORY_LABELS } from './categories';
import { SITE_NAME, SITE_URL, absoluteUrl } from './seo';
import { STATIC_PAGES } from './static-pages';
import { citationLines } from './toolbar';
import { toWidgetSpec } from './widget-spec';
import type { CalculatorConfig } from './types';

/** Where a calculator's markdown copy lives. */
export const markdownPath = (slug: string): string => `/calculators/${slug}.md`;

/** One line of text: no line breaks, no table-breaking pipes. */
const oneLine = (s: string): string => s.replace(/\s+/g, ' ').replace(/\|/g, '/').trim();

function rangeOf(input: { min?: number; max?: number; unitOptions?: { label: string }[] }): string {
  const parts: string[] = [];
  if (input.min !== undefined && input.max !== undefined) parts.push(`${input.min} to ${input.max}`);
  else if (input.min !== undefined) parts.push(`at least ${input.min}`);
  else if (input.max !== undefined) parts.push(`at most ${input.max}`);
  if (input.unitOptions?.length) parts.push(`options: ${input.unitOptions.map((o) => o.label).join(', ')}`);
  return parts.join('; ') || '-';
}

/** The page as markdown: what it computes, the inputs with their defaults, the default result, the method and the FAQ. */
export function calculatorMarkdown(config: CalculatorConfig): string {
  const spec = toWidgetSpec(config);
  const url = absoluteUrl(`/calculators/${config.slug}/`);
  const cite = citationLines(config.h1, url, config.lastUpdated);
  const disclaimer = disclaimerFor(config.category);
  const shown = config.outputs.filter((o) => spec.initialResults[o.name]);

  const lines: string[] = [
    `# ${config.h1}`,
    '',
    `> ${oneLine(config.metaDescription)}`,
    '',
    `- Live calculator: ${url}`,
    `- Category: ${CATEGORY_LABELS[config.category]}`,
    `- Last updated: ${config.lastUpdated}`,
    ...(spec.currency ? [`- Results are written in: ${spec.currency}`] : []),
    '',
    '## Inputs',
    '',
    '| Input | Default | Allowed |',
    '| --- | --- | --- |',
    ...config.inputs.map((i) => `| ${oneLine(i.label)} | ${oneLine(spec.defaults[i.name] ?? '')} | ${oneLine(rangeOf(i))} |`),
    '',
    '## Result with the default inputs',
    '',
    ...shown.map((o) => `- ${oneLine(o.label)}: ${oneLine(spec.initialResults[o.name])}`),
    '',
    '## How it is calculated',
    '',
    config.formulaDescription.trim(),
    ...(config.formulaLatex ? ['', `Formula (LaTeX): \`${config.formulaLatex.replace(/\s+/g, ' ').trim()}\``] : []),
    '',
    '## Worked example',
    '',
    config.workedExample.trim(),
    '',
    '## Frequently asked questions',
    '',
    ...config.faq.flatMap((f) => [`### ${oneLine(f.question)}`, '', f.answer.trim(), '']),
    ...(config.assumptions?.length ? ['## What this assumes', '', ...config.assumptions.map((a) => `- ${a}`), ''] : []),
    ...(config.references?.length
      ? [
          '## Sources',
          '',
          ...config.references.map((r) => `- [${oneLine(r.title)}](${r.url}), ${oneLine(r.publisher)}, checked ${r.accessed}. ${oneLine(r.supports)}`),
          '',
        ]
      : []),
    ...(disclaimer ? ['## Notice', '', disclaimer, ''] : []),
    '## Cite this page',
    '',
    `- APA: ${cite.apa}`,
    `- Plain: ${cite.plain}`,
    '',
    `Numbers on this page come from the same code as the live calculator, using exact decimal arithmetic. Source: ${SITE_NAME}, ${url}`,
    '',
  ];
  return lines.join('\n');
}

export interface LlmsOptions {
  /** URL of the MCP endpoint, once the server exists. */
  mcpUrl?: string;
}

/** /llms.txt: what the site is and every published calculator's markdown copy, grouped by category (llmstxt.org format). */
export function llmsTxt(configs: readonly CalculatorConfig[], options: LlmsOptions = {}): string {
  const byCategory = new Map<string, CalculatorConfig[]>();
  for (const c of configs) byCategory.set(c.category, [...(byCategory.get(c.category) ?? []), c]);

  const lines: string[] = [
    `# ${SITE_NAME}`,
    '',
    `> Free online calculators for everyday questions: finance, health, math, conversions and more. Every calculator shows its default result in plain HTML, uses exact decimal arithmetic, and explains its method with a worked example.`,
    '',
    `- Site: ${SITE_URL}`,
    `- Every calculator page has a markdown copy at the same address with the trailing slash replaced by .md, for example ${absoluteUrl(markdownPath('bmi-calculator'))}`,
    `- Cite a calculator by its page URL. Each markdown copy ends with a ready-made citation.`,
    ...(options.mcpUrl
      ? [
          `- Agents can run the calculators through an MCP server (tools: list_calculators, describe_calculator, calculate): ${options.mcpUrl}`,
          `- A JSON index of every calculator: ${absoluteUrl('/calculators.json')}`,
        ]
      : []),
    '- Health, finance, construction, chemistry, food and biology calculators are informational and are not professional advice.',
    '',
  ];
  for (const [category, list] of [...byCategory.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`## ${CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS]}`, '');
    for (const c of [...list].sort((a, b) => a.slug.localeCompare(b.slug)))
      lines.push(`- [${oneLine(c.h1)}](${absoluteUrl(markdownPath(c.slug))}): ${oneLine(c.metaDescription)}`);
    lines.push('');
  }
  lines.push('## About this site', '');
  for (const p of STATIC_PAGES) lines.push(`- [${p.label}](${absoluteUrl(p.path)})`);
  lines.push('');
  return lines.join('\n');
}
