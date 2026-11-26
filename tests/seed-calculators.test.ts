import { describe, expect, it } from 'vitest';
import { defaultInputs, runWith } from '../src/lib/calc-utils';
import { CATEGORIES, type CalculatorConfig } from '../src/lib/types';
import { registry } from '../src/lib/registry';

/** The 20 seed calculators from Prompt 1: slug, category, tier. */
const EXPECTED: [string, string, 1 | 2 | 3][] = [
  ['mortgage-calculator', 'finance', 1],
  ['bmi-calculator', 'health', 1],
  ['percentage-calculator', 'math', 1],
  ['age-calculator', 'everyday-life', 1],
  ['compound-interest-calculator', 'finance', 1],
  ['loan-calculator', 'finance', 2],
  ['calorie-calculator', 'health', 2],
  ['cm-to-inches', 'conversion', 2],
  ['concrete-calculator', 'construction', 2],
  ['standard-deviation-calculator', 'statistics', 2],
  ['tdee-calculator', 'health', 2],
  ['discount-calculator', 'finance', 2],
  ['date-difference-calculator', 'everyday-life', 2],
  ['tip-calculator', 'finance', 2],
  ['ohms-law-calculator', 'physics', 2],
  ['cagr-calculator', 'finance', 3],
  ['body-fat-calculator', 'health', 3],
  ['paint-calculator', 'construction', 3],
  ['sample-size-calculator', 'statistics', 3],
  ['dog-age-calculator', 'other', 3],
];

const files = import.meta.glob<{ default: CalculatorConfig }>('../src/calculators/*.ts', { eager: true });
const configs = Object.values(files).map((m) => m.default);
const bySlug = new Map(configs.map((c) => [c.slug, c]));

describe('the 20 seed calculators', () => {
  it('are exactly the planned set and every one passes the quality gate', () => {
    expect(configs.map((c) => c.slug).sort()).toEqual(EXPECTED.map(([s]) => s).sort());
    expect(registry.excluded).toEqual([]);
    expect(registry.valid.filter((c) => configs.includes(c))).toHaveLength(20);
  });

  it('each lives in a file named after its slug', () => {
    for (const [path, mod] of Object.entries(files)) expect(path.endsWith(`/${mod.default.slug}.ts`)).toBe(true);
  });

  it('are in the planned category and tier; only Tier 1 is published', () => {
    for (const [slug, category, tier] of EXPECTED) {
      const c = bySlug.get(slug)!;
      expect(c.category, slug).toBe(category);
      expect(CATEGORIES).toContain(c.category);
      expect(c.tier, slug).toBe(tier);
      expect(c.publish, slug).toBe(tier === 1);
    }
  });

  it('every file has its own test', async () => {
    const tests = import.meta.glob('./calculators/*.test.ts');
    expect(
      Object.keys(tests)
        .map((p) => p.replace(/^.*\/(.+)\.test\.ts$/, '$1'))
        .sort(),
    ).toEqual(EXPECTED.map(([s]) => s).sort());
  });
});

describe.each(configs.map((c) => [c.slug, c] as const))('%s', (_slug, c) => {
  it('has unique, well-sized search copy', () => {
    expect(c.title.length).toBeGreaterThan(20);
    expect(c.title.length).toBeLessThanOrEqual(75);
    expect(c.h1.length).toBeLessThanOrEqual(60);
    expect(c.metaDescription.length).toBeGreaterThanOrEqual(100);
    expect(c.metaDescription.length).toBeLessThanOrEqual(170);
    expect(c.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('answers in the first two sentences (the intro opens with a number)', () => {
    const firstTwo = c.intro
      .split(/(?<=[.!?])\s+(?=[A-Z$0-9])/)
      .slice(0, 2)
      .join(' ');
    expect(firstTwo).toMatch(/\d/);
  });

  it('has FAQs with real answers and a worked example', () => {
    expect(c.faq.length).toBeGreaterThanOrEqual(3);
    for (const f of c.faq) {
      expect(f.question.endsWith('?')).toBe(true);
      expect(f.answer.length).toBeGreaterThan(40);
    }
    expect(c.workedExample.length).toBeGreaterThan(40);
    expect(c.formulaDescription.length).toBeGreaterThan(40);
  });

  it('links only to other registered calculators, never itself', () => {
    expect(c.relatedSlugs.length).toBeGreaterThanOrEqual(1);
    expect(new Set(c.relatedSlugs).size).toBe(c.relatedSlugs.length);
    for (const s of c.relatedSlugs) {
      expect(s).not.toBe(c.slug);
      expect(bySlug.has(s), `${c.slug} -> ${s}`).toBe(true);
    }
  });

  it('every default input passes its own validator, and select defaults are real options', () => {
    for (const input of c.inputs) {
      expect(input.validator.safeParse(input.default).success, `${c.slug}.${input.name}`).toBe(true);
      if (input.type === 'select') {
        const values = (input.unitOptions ?? []).map((o) => o.value);
        expect(values, `${c.slug}.${input.name}`).toContain(String(input.default));
        for (const v of values) expect(input.validator.safeParse(v).success).toBe(true);
      }
      if (input.type === 'unit') expect((input.unitOptions ?? []).length).toBeGreaterThanOrEqual(2);
    }
  });

  it('rejects obviously bad number input', () => {
    for (const input of c.inputs.filter((i) => i.type === 'number' || i.type === 'unit')) {
      expect(input.validator.safeParse('').success).toBe(false);
      expect(input.validator.safeParse('abc').success).toBe(false);
    }
  });

  it('returns exactly its declared outputs with the default inputs, never NaN or Infinity', () => {
    const result = runWith(c);
    expect(Object.keys(result).sort()).toEqual(c.outputs.map((o) => o.name).sort());
    for (const [name, value] of Object.entries(result)) {
      expect(typeof value).toBe('string');
      expect(value, `${c.slug}.${name}`).not.toMatch(/NaN|Infinity|undefined|null|e\+|e-\d/);
      if (name !== 'note') expect(value.trim().length, `${c.slug}.${name}`).toBeGreaterThan(0);
    }
  });

  it('is deterministic and leaves its inputs untouched', () => {
    const inputs = defaultInputs(c);
    const snapshot = JSON.stringify(inputs);
    expect(c.calculate(inputs)).toEqual(c.calculate(inputs));
    expect(JSON.stringify(inputs)).toBe(snapshot);
  });

  it('has unique output names and a highlighted result', () => {
    const names = c.outputs.map((o) => o.name);
    expect(new Set(names).size).toBe(names.length);
    expect(c.outputs.some((o) => o.highlight)).toBe(true);
  });
});

describe('across all calculators', () => {
  it('titles, h1s and meta descriptions are all unique', () => {
    for (const key of ['title', 'h1', 'metaDescription'] as const) {
      const values = configs.map((c) => c[key]);
      expect(new Set(values).size, key).toBe(values.length);
    }
  });
});
