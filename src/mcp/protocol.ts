/**
 * The Opus Calculator MCP server (plan/PROMPT 19, item 20.7): the Model Context Protocol over plain HTTP, stateless, read-only.
 * Pure functions over an index of the published calculators and a loader for their configs, so they are tested against
 * every calculator and the Pages Function is a thin HTTP shell. An assistant that calls `calculate` gets the same numbers the page shows, because it runs the same
 * decimal.js `calculate()` after the same zod validators.
 *
 * What it will not do: store anything, call another service, run anything but a calculator, or reveal a calculator that is
 * not published (CLAUDE.md rule 6).
 */
import { disclaimerFor } from '../content/disclaimers';
import { defaultInputs } from '../lib/calc-utils';
import { CATEGORY_LABELS } from '../lib/categories';
import { markdownPath } from '../lib/markdown';
import type { CalculatorIndexEntry } from '../lib/calculator-index';
import { citationLines } from '../lib/toolbar';
import type { CalculatorConfig } from '../lib/types';

export const SITE = 'https://opuscalculator.com';
export const SUPPORTED_PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'] as const;
export const SERVER_INFO = { name: 'opus-calculator', title: 'Opus Calculator', version: '1.0.0' } as const;

/** Limits that keep a public endpoint cheap and boring. */
export const MAX_BODY_BYTES = 16 * 1024;
export const MAX_VALUE_LENGTH = 100;
export const MAX_INPUTS = 40;
export const MAX_LIST = 50;

export interface McpContext {
  /** The calculators the site publishes (/calculators.json), by slug. Anything else does not exist as far as a caller can tell. */
  index: ReadonlyMap<string, CalculatorIndexEntry>;
  /** Loads one calculator's config on demand, so the Function never builds the whole catalogue at startup. */
  load: (slug: string) => Promise<CalculatorConfig | undefined>;
}

export interface JsonRpcError {
  code: number;
  message: string;
}
export type JsonRpcResponse =
  { jsonrpc: '2.0'; id: string | number | null; result: unknown } | { jsonrpc: '2.0'; id: string | number | null; error: JsonRpcError };

const ok = (id: JsonRpcResponse['id'], result: unknown): JsonRpcResponse => ({ jsonrpc: '2.0', id, result });
const fail = (id: JsonRpcResponse['id'], code: number, message: string): JsonRpcResponse => ({ jsonrpc: '2.0', id, error: { code, message } });

export const TOOLS = [
  {
    name: 'list_calculators',
    title: 'List calculators',
    description:
      'Find calculators on Opus Calculator. Filter by category and/or search words (matched against title, description and slug). Returns slug, title, category, description and page URL.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Words to look for, for example "mortgage" or "body mass".', maxLength: 100 },
        category: { type: 'string', description: 'A category slug such as finance, health, math, conversion, everyday-life.', maxLength: 40 },
        limit: { type: 'integer', minimum: 1, maximum: MAX_LIST, default: 20 },
        offset: { type: 'integer', minimum: 0, default: 0 },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'describe_calculator',
    title: 'Describe a calculator',
    description:
      'Everything needed to call `calculate` correctly: the inputs (name, label, type, default, allowed range or options), the outputs, the formula in words and a worked example.',
    inputSchema: {
      type: 'object',
      properties: { slug: { type: 'string', description: 'The calculator slug from list_calculators, for example "bmi-calculator".', maxLength: 100 } },
      required: ['slug'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'calculate',
    title: 'Run a calculator',
    description:
      'Run a calculator with exact decimal arithmetic. Pass the slug and any inputs to change; every input you leave out uses its default. Returns each result with its label, the inputs used and the page URL. Health, finance and similar results are informational, not advice.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', maxLength: 100 },
        inputs: {
          type: 'object',
          description: 'Input name to value, as listed by describe_calculator. Numbers or strings. For unit inputs also pass <name>Unit.',
          additionalProperties: { type: ['string', 'number'] },
        },
      },
      required: ['slug'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  },
] as const;

const INSTRUCTIONS =
  'Opus Calculator runs free calculators (finance, health, math, conversions and more) with exact decimal arithmetic. Use list_calculators to find one, describe_calculator to see its inputs, then calculate. Results are informational and match the calculator pages on opuscalculator.com. Cite the page URL that each result returns.';

interface ToolResult {
  content: { type: 'text'; text: string }[];
  structuredContent?: unknown;
  isError?: boolean;
}

const text = (t: string, structured?: unknown): ToolResult => ({
  content: [{ type: 'text', text: t }],
  ...(structured === undefined ? {} : { structuredContent: structured }),
});
const toolError = (message: string): ToolResult => ({ content: [{ type: 'text', text: message }], isError: true });

const pageUrl = (slug: string): string => `${SITE}/calculators/${slug}/`;
const summary = (c: CalculatorConfig) => ({ slug: c.slug, title: c.h1, category: c.category, description: c.metaDescription, url: pageUrl(c.slug) });

async function find(ctx: McpContext, slug: unknown): Promise<CalculatorConfig | undefined> {
  if (typeof slug !== 'string' || !ctx.index.has(slug)) return undefined;
  try {
    return await ctx.load(slug);
  } catch {
    return undefined;
  }
}

const asRecord = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

function listCalculators(ctx: McpContext, args: Record<string, unknown>): ToolResult {
  const limit = Math.min(MAX_LIST, Math.max(1, Number.isInteger(args.limit) ? (args.limit as number) : 20));
  const offset = Math.max(0, Number.isInteger(args.offset) ? (args.offset as number) : 0);
  const category = typeof args.category === 'string' ? args.category.trim().toLowerCase() : '';
  const words = typeof args.query === 'string' ? args.query.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 8) : [];
  const matches = [...ctx.index.values()]
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .filter((c) => !category || c.category === category)
    .filter((c) => {
      const haystack = `${c.title} ${c.description} ${c.slug}`.toLowerCase();
      return words.every((w) => haystack.includes(w));
    });
  const page = matches
    .slice(offset, offset + limit)
    .map(({ slug, title, category: cat, description, url }) => ({ slug, title, category: cat, description, url }));
  const lines = page.map((c) => `- ${c.title} (${c.slug}): ${c.description}`);
  return text(
    `${matches.length} calculator${matches.length === 1 ? '' : 's'} found${page.length ? `, showing ${offset + 1} to ${offset + page.length}` : ''}.\n${lines.join('\n')}`,
    { total: matches.length, offset, calculators: page, categories: Object.keys(CATEGORY_LABELS) },
  );
}

async function describeCalculator(ctx: McpContext, args: Record<string, unknown>): Promise<ToolResult> {
  const c = await find(ctx, args.slug);
  if (!c) return toolError(`No calculator with the slug "${String(args.slug).slice(0, 100)}". Use list_calculators to find one.`);
  const structured = {
    ...summary(c),
    markdown: `${SITE}${markdownPath(c.slug)}`,
    lastUpdated: c.lastUpdated,
    inputs: c.inputs.map((i) => ({
      name: i.name,
      label: i.label,
      type: i.type,
      default: i.default,
      ...(i.min !== undefined ? { min: i.min } : {}),
      ...(i.max !== undefined ? { max: i.max } : {}),
      ...(i.unitOptions?.length
        ? { options: i.unitOptions.map((o) => ({ value: o.value, label: o.label })), unitInput: i.type === 'unit' ? `${i.name}Unit` : undefined }
        : {}),
    })),
    outputs: c.outputs.map((o) => ({ name: o.name, label: o.label, format: o.format })),
    formula: c.formulaDescription,
    workedExample: c.workedExample,
    notice: disclaimerFor(c.category),
  };
  return text(
    `${c.h1}\n${c.metaDescription}\n\nInputs:\n${c.inputs.map((i) => `- ${i.name} (${i.label}), default ${i.default}`).join('\n')}\n\nFormula: ${c.formulaDescription}\n\nPage: ${pageUrl(c.slug)}`,
    structured,
  );
}

async function calculate(ctx: McpContext, args: Record<string, unknown>): Promise<ToolResult> {
  const c = await find(ctx, args.slug);
  if (!c) return toolError(`No calculator with the slug "${String(args.slug).slice(0, 100)}". Use list_calculators to find one.`);
  const given = asRecord(args.inputs);
  const names = new Set(c.inputs.flatMap((i) => (i.type === 'unit' && i.unitOptions?.length ? [i.name, `${i.name}Unit`] : [i.name])));
  if (Object.keys(given).length > MAX_INPUTS) return toolError(`Too many inputs (more than ${MAX_INPUTS}).`);
  const unknown = Object.keys(given).filter((k) => !names.has(k));
  if (unknown.length)
    return toolError(
      `Unknown input${unknown.length > 1 ? 's' : ''}: ${unknown.map((k) => k.slice(0, 40)).join(', ')}. Valid inputs: ${[...names].join(', ')}.`,
    );

  // Same path as the widget: every value is a string, every input goes through its zod validator, then calculate().
  const values: Record<string, string> = {};
  for (const [k, v] of Object.entries(defaultInputs(c))) values[k] = String(v);
  for (const [k, v] of Object.entries(given)) {
    if (typeof v !== 'string' && typeof v !== 'number') return toolError(`The value for "${k.slice(0, 40)}" must be a string or a number.`);
    const s = String(v);
    if (s.length > MAX_VALUE_LENGTH) return toolError(`The value for "${k.slice(0, 40)}" is longer than ${MAX_VALUE_LENGTH} characters.`);
    values[k] = s;
  }
  const problems: string[] = [];
  for (const input of c.inputs) {
    const parsed = input.validator.safeParse(values[input.name]);
    if (!parsed.success) problems.push(`${input.name}: ${parsed.error.issues[0]?.message ?? 'check this value'}`);
  }
  if (problems.length) return toolError(`Fix these inputs and try again. ${problems.join('; ')}`);

  let raw: Record<string, string>;
  try {
    raw = c.calculate(values);
  } catch {
    return toolError('This calculator could not compute a result for those inputs.');
  }
  const results = c.outputs.filter((o) => raw[o.name]).map((o) => ({ name: o.name, label: o.label, value: raw[o.name] }));
  const url = pageUrl(c.slug);
  const notice = disclaimerFor(c.category);
  const cite = citationLines(c.h1, url, c.lastUpdated);
  return text(`${c.h1}\n${results.map((r) => `${r.label}: ${r.value}`).join('\n')}\n\nSource: ${url}${notice ? `\nNotice: ${notice}` : ''}`, {
    slug: c.slug,
    title: c.h1,
    url,
    inputs: values,
    results,
    notice,
    citation: cite.apa,
  });
}

async function callTool(ctx: McpContext, name: unknown, args: unknown): Promise<ToolResult | null> {
  const a = asRecord(args);
  if (name === 'list_calculators') return listCalculators(ctx, a);
  if (name === 'describe_calculator') return await describeCalculator(ctx, a);
  if (name === 'calculate') return await calculate(ctx, a);
  return null;
}

/**
 * One JSON-RPC message in, one response out (null for a notification, which gets HTTP 202 and no body). Batches are not
 * accepted: the 2025-06-18 revision of the protocol removed them.
 */
export async function handleMcpMessage(message: unknown, ctx: McpContext): Promise<JsonRpcResponse | null> {
  if (Array.isArray(message)) return fail(null, -32600, 'Batch requests are not supported. Send one message per request.');
  if (!message || typeof message !== 'object') return fail(null, -32600, 'Invalid request.');
  const m = message as { jsonrpc?: unknown; id?: unknown; method?: unknown; params?: unknown };
  const hasId = typeof m.id === 'string' || typeof m.id === 'number';
  if (m.jsonrpc !== '2.0' || typeof m.method !== 'string')
    return fail(hasId ? (m.id as string | number) : null, -32600, 'Invalid request: expected a JSON-RPC 2.0 message with a method.');
  if (!hasId) return null; // a notification, such as notifications/initialized
  const id = m.id as string | number;
  const params = asRecord(m.params);

  switch (m.method) {
    case 'initialize': {
      const wanted = typeof params.protocolVersion === 'string' ? params.protocolVersion : '';
      const version = (SUPPORTED_PROTOCOLS as readonly string[]).includes(wanted) ? wanted : SUPPORTED_PROTOCOLS[0];
      return ok(id, { protocolVersion: version, capabilities: { tools: { listChanged: false } }, serverInfo: SERVER_INFO, instructions: INSTRUCTIONS });
    }
    case 'ping':
      return ok(id, {});
    case 'tools/list':
      return ok(id, { tools: TOOLS });
    case 'tools/call': {
      const result = await callTool(ctx, params.name, params.arguments);
      return result ? ok(id, result) : fail(id, -32602, `Unknown tool: ${String(params.name).slice(0, 60)}`);
    }
    default:
      return fail(id, -32601, `Method not found: ${m.method.slice(0, 60)}`);
  }
}
