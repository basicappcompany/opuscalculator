import { describe, expect, it, vi } from 'vitest';
import loan from '../src/calculators/loan-calculator';
import mortgage from '../src/calculators/mortgage-calculator';
import bmi from '../src/calculators/bmi-calculator';
import {
  buildRegistry,
  generated,
  getAllSlugs,
  handWritten,
  getCalculatorBySlug,
  getCalculatorsByCategory,
  getPublishableCalculators,
} from '../src/lib/registry';

const slugs = (list: { slug: string }[]) => list.map((c) => c.slug).sort();

describe('buildRegistry', () => {
  it('throws on a duplicate slug rather than picking one', () => {
    expect(() => buildRegistry([mortgage, { ...mortgage }], () => {})).toThrow('Duplicate calculator slug "mortgage-calculator"');
  });

  it('excludes a calculator that fails the gate, warns, and does not throw', () => {
    const warn = vi.fn();
    const bad = { ...loan, slug: 'short-intro', intro: 'Far too short.' };
    const r = buildRegistry([mortgage, bad], warn);
    expect(slugs([...r.valid])).toEqual(['mortgage-calculator']);
    expect(r.excluded).toHaveLength(1);
    expect(r.excluded[0].slug).toBe('short-intro');
    expect(r.excluded[0].reasons.join()).toMatch(/intro has 3 words/);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"short-intro" excluded by the quality gate'));
  });

  it('excludes both of two near-identical intros', () => {
    const twin = { ...loan, slug: 'twin', faq: loan.faq.map((f) => ({ ...f, question: `${f.question} (twin)` })) };
    const r = buildRegistry([loan, twin], () => {});
    expect(r.valid).toHaveLength(0);
    expect(r.excluded).toHaveLength(2);
  });

  it('warns about relatedSlugs that point nowhere but keeps the page', () => {
    const warn = vi.fn();
    const r = buildRegistry([{ ...mortgage, relatedSlugs: ['nope'] }], warn);
    expect(r.valid).toHaveLength(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('unknown relatedSlugs: nope'));
  });
});

describe('the real registry', () => {
  it('publishes only the five Tier 1 calculators', () => {
    expect(slugs(getPublishableCalculators())).toEqual([
      'age-calculator',
      'bmi-calculator',
      'compound-interest-calculator',
      'mortgage-calculator',
      'percentage-calculator',
    ]);
    expect(getPublishableCalculators(1)).toHaveLength(5);
    expect(getPublishableCalculators(2)).toEqual([]);
    expect(getPublishableCalculators(3)).toEqual([]);
  });

  it('getAllSlugs includes unpublished slugs; getCalculatorBySlug finds any registered one', () => {
    expect(getAllSlugs()).toHaveLength(handWritten.length + generated.length);
    expect(handWritten).toHaveLength(20);
    expect(getAllSlugs()).toContain('loan-calculator');
    expect(getCalculatorBySlug('bmi-calculator')?.slug).toBe(bmi.slug);
    expect(getCalculatorBySlug('loan-calculator')?.publish).toBe(false);
    expect(getCalculatorBySlug('does-not-exist')).toBeUndefined();
  });

  it('getCalculatorsByCategory returns published pages only unless asked (rule 6)', () => {
    expect(slugs(getCalculatorsByCategory('finance'))).toEqual(['compound-interest-calculator', 'mortgage-calculator']);
    // generated finance pages exist too; the six hand-written ones are the seeds
    expect(getCalculatorsByCategory('finance', { includeUnpublished: true }).filter((c) => handWritten.includes(c))).toHaveLength(6);
    expect(slugs(getCalculatorsByCategory('health'))).toEqual(['bmi-calculator']);
    expect(getCalculatorsByCategory('physics')).toEqual([]);
    // biology has generated pages, but none is live while its cohort is off (rule 6)
    expect(getCalculatorsByCategory('biology')).toEqual([]);
    expect(getCalculatorsByCategory('biology', { includeUnpublished: true }).length).toBeGreaterThan(0);
  });
});
