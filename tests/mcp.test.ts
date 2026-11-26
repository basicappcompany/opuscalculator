import { describe, expect, it } from 'vitest';
import { calculatorIndexProblems } from '../src/lib/ai-discovery-checks';
import { calculatorIndex } from '../src/lib/calculator-index';
import { registry } from '../src/lib/registry';
import { toWidgetSpec } from '../src/lib/widget-spec';
import { createCore, fromGenerator, fromModule } from '../src/mcp/core';
import { MAX_INPUTS, MAX_LIST, MAX_VALUE_LENGTH, SUPPORTED_PROTOCOLS, TOOLS, handleMcpMessage, type McpContext } from '../src/mcp/protocol';
import { overLimit } from '../src/mcp/rate-limit';
import { buildCatalog } from './support/mcp-catalog';

const catalog = buildCatalog();
const contextFor = (slugs: Iterable<string>): McpContext => ({
  index: new Map(calculatorIndex([...slugs].map((s) => catalog.get(s)!)).calculators.map((c) => [c.slug, c])),
  load: async (slug) => catalog.get(slug),
});
const ctx = contextFor(['bmi-calculator', 'mortgage-calculator', 'percentage-calculator']);

let nextId = 1;
type Reply = { result?: any; error?: { code: number; message: string } };
const rpc = async (method: string, params?: unknown) => (await handleMcpMessage({ jsonrpc: '2.0', id: nextId++, method, params }, ctx)) as Reply;
const call = async (name: string, args?: unknown) =>
  (await rpc('tools/call', { name, arguments: args })).result as { content: { text: string }[]; structuredContent?: any; isError?: boolean };

describe('MCP protocol (item 20.7)', () => {
  it('initializes, echoing a supported protocol version and offering tools', async () => {
    const r = (await rpc('initialize', { protocolVersion: '2025-03-26', clientInfo: { name: 'test' }, capabilities: {} })).result;
    expect(r.protocolVersion).toBe('2025-03-26');
    expect(r.capabilities).toEqual({ tools: { listChanged: false } });
    expect(r.serverInfo.name).toBe('opus-calculator');
    expect((await rpc('initialize', { protocolVersion: '1999-01-01' })).result.protocolVersion).toBe(SUPPORTED_PROTOCOLS[0]);
  });

  it('answers ping and lists exactly the three read-only tools', async () => {
    expect((await rpc('ping')).result).toEqual({});
    const tools = (await rpc('tools/list')).result.tools as typeof TOOLS;
    expect(tools.map((t) => t.name)).toEqual(['list_calculators', 'describe_calculator', 'calculate']);
    for (const t of tools) expect(t.annotations.readOnlyHint).toBe(true);
  });

  it('treats a notification as no reply, and refuses batches, bad messages, unknown methods and tools', async () => {
    expect(await handleMcpMessage({ jsonrpc: '2.0', method: 'notifications/initialized' }, ctx)).toBeNull();
    expect(((await handleMcpMessage([{ jsonrpc: '2.0', id: 1, method: 'ping' }], ctx)) as any).error.code).toBe(-32600);
    expect(((await handleMcpMessage('hello', ctx)) as any).error.code).toBe(-32600);
    expect(((await handleMcpMessage({ id: 1, method: 'ping' }, ctx)) as any).error.code).toBe(-32600);
    expect((await rpc('resources/list')).error?.code).toBe(-32601);
    expect((await rpc('tools/call', { name: 'rm_rf', arguments: {} })).error?.code).toBe(-32602);
  });
});

describe('list_calculators', () => {
  it('lists only published calculators, filters by category and words, and pages', async () => {
    const all = (await call('list_calculators')).structuredContent;
    expect(all.total).toBe(3);
    expect(all.calculators.map((c: any) => c.slug)).toEqual(['bmi-calculator', 'mortgage-calculator', 'percentage-calculator']);
    expect((await call('list_calculators', { category: 'finance' })).structuredContent.calculators.map((c: any) => c.slug)).toEqual(['mortgage-calculator']);
    expect((await call('list_calculators', { query: 'body mass' })).structuredContent.calculators.map((c: any) => c.slug)).toEqual(['bmi-calculator']);
    expect((await call('list_calculators', { limit: 1, offset: 1 })).structuredContent.calculators).toHaveLength(1);
    expect((await call('list_calculators', { limit: 9999 })).structuredContent.calculators.length).toBeLessThanOrEqual(MAX_LIST);
  });

  it('does not reveal a calculator the site has not published, even one that exists in the code', async () => {
    expect(catalog.has('loan-calculator')).toBe(true);
    expect(JSON.stringify((await call('list_calculators', { query: 'loan' })).structuredContent)).not.toContain('loan-calculator');
    expect((await call('describe_calculator', { slug: 'loan-calculator' })).isError).toBe(true);
    expect((await call('calculate', { slug: 'loan-calculator' })).isError).toBe(true);
  });
});

describe('describe_calculator', () => {
  it('gives the inputs with defaults and ranges, the outputs, the formula and a worked example', async () => {
    const d = (await call('describe_calculator', { slug: 'bmi-calculator' })).structuredContent;
    expect(d.url).toBe('https://opuscalculator.com/calculators/bmi-calculator/');
    expect(d.markdown).toBe('https://opuscalculator.com/calculators/bmi-calculator.md');
    expect(d.inputs.find((i: any) => i.name === 'weight')).toMatchObject({ default: 70, min: 1, max: 1500, unitInput: 'weightUnit' });
    expect(d.outputs.map((o: any) => o.name)).toContain('bmi');
    expect(d.formula).toContain('BMI');
    expect(d.notice).toContain('not a substitute for professional medical advice');
  });
});

describe('calculate', () => {
  it('runs the calculator with its defaults and with changed inputs, to the cent', async () => {
    expect((await call('calculate', { slug: 'bmi-calculator' })).structuredContent.results[0]).toMatchObject({ name: 'bmi', value: '22.9' });
    const m = await call('calculate', { slug: 'mortgage-calculator', inputs: { homePrice: 250000, downPayment: 50000, interestRate: 6, termYears: 30 } });
    expect(m.structuredContent.results.find((r: any) => r.name === 'monthlyPayment').value).toBe('$1,199.10');
    expect(m.content[0].text).toContain('Source: https://opuscalculator.com/calculators/mortgage-calculator/');
    expect(m.structuredContent.citation).toContain('Opus Calculator.');
  });

  it('rejects bad input as a tool error that says what to fix, never a crash', async () => {
    const bad = await call('calculate', { slug: 'bmi-calculator', inputs: { weight: 'abc' } });
    expect(bad.isError).toBe(true);
    expect(bad.content[0].text).toMatch(/weight/);
    expect((await call('calculate', { slug: 'bmi-calculator', inputs: { nope: 1 } })).content[0].text).toMatch(/Unknown input: nope\. Valid inputs: weight/);
    expect((await call('calculate', { slug: 'bmi-calculator', inputs: { weight: { a: 1 } } })).isError).toBe(true);
    expect((await call('calculate', { slug: 'bmi-calculator', inputs: { weight: '9'.repeat(MAX_VALUE_LENGTH + 1) } })).content[0].text).toMatch(/longer than/);
    const many = Object.fromEntries(Array.from({ length: MAX_INPUTS + 1 }, (_, i) => [`k${i}`, 1]));
    expect((await call('calculate', { slug: 'bmi-calculator', inputs: many })).content[0].text).toMatch(/Too many inputs/);
    expect((await call('calculate', { slug: 42 })).isError).toBe(true);
    expect((await call('calculate')).isError).toBe(true);
  });

  // Found by this very test: these two physics calculators prefill a value their own validator rejects (5.972e24 has no
  // plain-decimal form the input accepts, and 9.109e-31 is below the 0.000001 minimum), so on the page any edit shows
  // "Enter a number" and over MCP the defaults cannot be used. Tracked as a defect (docs/status.html 5.16). When one is fixed
  // this test fails until it is removed from the list, so the list cannot go stale.
  const KNOWN_DEFAULT_INPUT_DEFECTS = ['de-broglie-wavelength-calculator', 'gravitational-force-calculator']; // sorted

  it('gives, for EVERY calculator in the registry, the same numbers the page shows by default', async () => {
    expect(registry.valid.length).toBeGreaterThan(1000);
    const everything = contextFor(registry.valid.map((c) => c.slug));
    const mismatches: string[] = [];
    const failingDefaults: string[] = [];
    for (const config of registry.valid) {
      const message = { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'calculate', arguments: { slug: config.slug } } };
      const result = ((await handleMcpMessage(message, everything)) as any).result;
      if (result.isError) {
        failingDefaults.push(config.slug);
        continue;
      }
      const page = toWidgetSpec(config).initialResults;
      for (const r of result.structuredContent.results)
        if (page[r.name] !== r.value) mismatches.push(`${config.slug}.${r.name}: MCP ${r.value} vs page ${page[r.name]}`);
    }
    expect(mismatches).toEqual([]);
    expect(failingDefaults.sort()).toEqual(KNOWN_DEFAULT_INPUT_DEFECTS);
  });
});

describe('the lazy core (why the Function now starts quickly)', () => {
  const ask = (core: ReturnType<typeof createCore>, index: McpContext['index'], slug: string) =>
    core.handleMcp({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'calculate', arguments: { slug } } }, index) as Promise<any>;

  it('builds a calculator only when it is asked for, once, and refuses a slug it has no loader for', async () => {
    let builds = 0;
    const core = createCore({
      'bmi-calculator': fromModule(async () => {
        builds += 1;
        return { default: catalog.get('bmi-calculator')! };
      }),
    });
    expect(core.count).toBe(1);
    expect(builds).toBe(0); // nothing is built at startup
    expect((await ask(core, ctx.index, 'bmi-calculator')).result.isError).toBeUndefined();
    await ask(core, ctx.index, 'bmi-calculator');
    expect(builds).toBe(1); // cached after the first call
    expect((await ask(core, ctx.index, 'mortgage-calculator')).result.isError).toBe(true); // published, but this bundle has no loader for it
    expect((await ask(core, contextFor(['bmi-calculator']).index, 'toString')).result.isError).toBe(true); // not a prototype lookup
  });

  it('runs a generator file once for all of its calculators', async () => {
    let runs = 0;
    const two = [catalog.get('loan-calculator')!, catalog.get('cagr-calculator')!];
    const importer = async () => ({
      default: () => {
        runs += 1;
        return two;
      },
    });
    const core = createCore({
      'loan-calculator': fromGenerator('finance-test', importer, 'loan-calculator'),
      'cagr-calculator': fromGenerator('finance-test', importer, 'cagr-calculator'),
    });
    const index = contextFor(['loan-calculator', 'cagr-calculator']).index;
    for (const slug of ['loan-calculator', 'cagr-calculator']) expect((await ask(core, index, slug)).result.isError, slug).toBeUndefined();
    expect(runs).toBe(1);
  });
});

describe('/calculators.json (the list of calculators that exist)', () => {
  const pages = (slugs: string[]) => new Map(slugs.map((s) => [`/calculators/${s}/`, '<html></html>']));
  const index = (slugs: string[]) => JSON.stringify(calculatorIndex(slugs.map((s) => catalog.get(s)!)));

  it('passes when it lists exactly the published pages', () => {
    expect(calculatorIndexProblems(pages(['bmi-calculator', 'mortgage-calculator']), index(['bmi-calculator', 'mortgage-calculator']))).toEqual([]);
  });

  it('fails when it is missing, lists an unpublished calculator, omits a published one or has a wrong URL', () => {
    expect(calculatorIndexProblems(pages([]), undefined)).toEqual(['dist/calculators.json is missing']);
    expect(calculatorIndexProblems(pages(['bmi-calculator']), index(['bmi-calculator', 'loan-calculator'])).join()).toMatch(
      /loan-calculator, which is not a published/,
    );
    expect(calculatorIndexProblems(pages(['bmi-calculator', 'mortgage-calculator']), index(['bmi-calculator'])).join()).toMatch(
      /does not list the published calculator mortgage-calculator/,
    );
    expect(calculatorIndexProblems(pages(['bmi-calculator']), index(['bmi-calculator']).replace('/calculators/bmi-calculator/', '/x/')).join()).toMatch(
      /wrong URL/,
    );
  });
});

describe('the best-effort rate limit in the Function', () => {
  it('lets 60 requests a minute through per address and then refuses, per address and per window', () => {
    const t = 1_000_000;
    for (let i = 0; i < 60; i += 1) expect(overLimit('203.0.113.9', t + i)).toBe(false);
    expect(overLimit('203.0.113.9', t + 61)).toBe(true);
    expect(overLimit('203.0.113.10', t + 61)).toBe(false);
    expect(overLimit('203.0.113.9', t + 60_001)).toBe(false);
  });
});
