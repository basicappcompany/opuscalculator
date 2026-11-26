import { describe, expect, it } from 'vitest';
import bmi from '../src/calculators/bmi-calculator';
import { REFERENCES_PENDING } from '../src/config/references-pending';
import { calculatorMarkdown } from '../src/lib/markdown';
import { MAX_REFERENCES, configReferenceProblems, referenceProblems, referenceSectionProblems } from '../src/lib/references';
import { registry } from '../src/lib/registry';
import { validateForIndexing } from '../src/lib/quality-gate';
import { calculatorJsonLd } from '../src/lib/seo';
import type { CalculatorConfig, Reference } from '../src/lib/types';

const good: Reference = {
  title: 'Body mass index (BMI): the WHO definition',
  publisher: 'World Health Organization',
  url: 'https://www.who.int/example/bmi',
  accessed: '2026-11-20',
  supports: 'The adult weight categories used by this calculator.',
};
const TODAY = '2026-11-27';

describe('what makes a reference acceptable (item 20.12)', () => {
  it('accepts a complete outside source', () => {
    expect(referenceProblems(good, TODAY)).toEqual([]);
  });

  it('rejects a missing title, publisher or purpose, a bad or future date, and says which', () => {
    expect(referenceProblems({ ...good, title: 'x' }, TODAY).join()).toMatch(/title/);
    expect(referenceProblems({ ...good, publisher: '' }, TODAY).join()).toMatch(/publisher/);
    expect(referenceProblems({ ...good, supports: 'ok' }, TODAY).join()).toMatch(/supports/);
    expect(referenceProblems({ ...good, accessed: '27/11/2026' }, TODAY).join()).toMatch(/ISO date/);
    expect(referenceProblems({ ...good, accessed: '2027-01-01' }, TODAY).join()).toMatch(/future/);
  });

  it('rejects http, this site itself, credentials, tracking or secret parameters and nonsense addresses', () => {
    expect(referenceProblems({ ...good, url: 'http://www.who.int/x' }, TODAY).join()).toMatch(/https/);
    expect(referenceProblems({ ...good, url: 'https://opuscalculator.com/about/' }, TODAY).join()).toMatch(/outside source/);
    expect(referenceProblems({ ...good, url: 'https://www.opuscalculator.com/' }, TODAY).join()).toMatch(/outside source/);
    expect(referenceProblems({ ...good, url: 'https://user:pw@www.who.int/x' }, TODAY).join()).toMatch(/credentials/);
    expect(referenceProblems({ ...good, url: 'https://www.who.int/x?utm_source=a' }, TODAY).join()).toMatch(/tracking/);
    expect(referenceProblems({ ...good, url: 'https://www.who.int/x?api_key=abc' }, TODAY).join()).toMatch(/tracking or secret/);
    expect(referenceProblems({ ...good, url: 'not a url' }, TODAY).join()).toMatch(/valid address/);
  });

  it('keeps the list short, without repeats, and assumptions meaningful', () => {
    expect(configReferenceProblems({ references: [good, { ...good, url: 'https://www.who.int/example/bmi/#top' }] }, TODAY).join()).toMatch(/listed twice/);
    const many = Array.from({ length: MAX_REFERENCES + 1 }, (_, i) => ({ ...good, url: `https://www.who.int/${i}` }));
    expect(configReferenceProblems({ references: many }, TODAY).join()).toMatch(/at most/);
    expect(configReferenceProblems({ references: [good], assumptions: ['Too short'] }, TODAY).join()).toBe('');
    expect(configReferenceProblems({ assumptions: ['x'] }, TODAY).join()).toMatch(/too short/);
    expect(configReferenceProblems({}, TODAY)).toEqual([]); // absent is fine here: that is a build check, not a gate rule
  });
});

describe('the quality gate and the page output', () => {
  const withRefs = (c: CalculatorConfig, refs: Reference[]): CalculatorConfig => ({ ...c, references: refs });

  it('lets a calculator with good references through and keeps one with a bad reference out of the registry', () => {
    expect(validateForIndexing(withRefs(bmi, [good])).reasons.filter((r) => /reference/.test(r))).toEqual([]);
    const bad = validateForIndexing(withRefs(bmi, [{ ...good, url: 'http://insecure.example/x' }]));
    expect(bad.pass).toBe(false);
    expect(bad.reasons.join()).toMatch(/reference 1: url must be https/);
  });

  it('puts the sources into the structured data and the markdown copy', () => {
    const ld = calculatorJsonLd(withRefs(bmi, [good]), '/calculators/bmi-calculator/', [{ label: 'Home', href: '/' }]);
    const app = ld['@graph'][0] as { citation: { name: string; publisher: { name: string } }[] };
    expect(app.citation[0]).toMatchObject({ name: good.title, publisher: { name: good.publisher } });
    expect(calculatorMarkdown(withRefs(bmi, [good]))).toContain(`## Sources\n\n- [${good.title}](${good.url}), ${good.publisher}, checked 2026-11-20.`);
    expect(JSON.stringify(calculatorJsonLd(bmi, '/calculators/bmi-calculator/', [{ label: 'Home', href: '/' }]))).not.toContain('"citation"');
    expect(calculatorMarkdown(bmi)).not.toContain('## Sources');
  });
});

describe('the build fails when a published calculator shows no source (item 20.12)', () => {
  const page = (sources: number) => `<main>${Array.from({ length: sources }, () => '<a href="https://x.example/" data-reference>s</a>').join('')}</main>`;
  const pages = (entries: Record<string, number>) => new Map(Object.entries(entries).map(([slug, n]) => [`/calculators/${slug}/`, page(n)]));

  it('passes a page with a source, and a pending page without one', () => {
    expect(referenceSectionProblems(pages({ a: 1, b: 0 }), new Set(['b']))).toEqual([]);
  });

  it('names a published calculator with no source that is not pending', () => {
    expect(referenceSectionProblems(pages({ a: 0 }), new Set()).join()).toMatch(/\/calculators\/a\/ shows no source: add references to a/);
  });

  it('makes the pending list shrink: a pending calculator with sources, or one that is not published, is an error', () => {
    expect(referenceSectionProblems(pages({ a: 2 }), new Set(['a'])).join()).toMatch(/remove it from src\/config\/references-pending\.ts/);
    expect(referenceSectionProblems(pages({ a: 1 }), new Set(['gone'])).join()).toMatch(/lists gone, which is not a published calculator/);
  });

  it('keeps the real pending list to calculators that exist and still lack sources', () => {
    const slugs = new Set(registry.valid.map((c) => c.slug));
    for (const slug of REFERENCES_PENDING) {
      expect(slugs.has(slug), slug).toBe(true);
      expect(registry.valid.find((c) => c.slug === slug)!.references ?? [], slug).toEqual([]);
    }
  });
});
