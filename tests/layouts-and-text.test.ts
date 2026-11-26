import { describe, expect, it } from 'vitest';
import { CATEGORIES } from '../src/lib/types';
import { WIDGET_VARIANT, layoutFor } from '../src/lib/layout';
import { renderLatex, renderMathText, splitIntro } from '../src/lib/text';
import { scenarioTable } from '../src/lib/scenarios';
import { linkedCalculators, linksFor } from '../src/lib/linking';
import { getPublishableCalculators, isPublished } from '../src/lib/registry';
import bmi from '../src/calculators/bmi-calculator';
import percentage from '../src/calculators/percentage-calculator';
import age from '../src/calculators/age-calculator';

describe('layout by category', () => {
  it('assigns every category a layout, so no calculator can be left without one', () => {
    for (const c of CATEGORIES) expect(['A', 'B', 'C']).toContain(layoutFor(c));
  });

  it('follows the plan: finance and health A, math and physics B, the rest C', () => {
    expect(['finance', 'health'].map((c) => layoutFor(c as never))).toEqual(['A', 'A']);
    expect(['math', 'physics'].map((c) => layoutFor(c as never))).toEqual(['B', 'B']);
    for (const c of ['everyday-life', 'conversion', 'construction', 'food', 'sports', 'other'] as const) expect(layoutFor(c)).toBe('C');
  });

  it('renders BMI in layout A and percentage in layout B', () => {
    expect(layoutFor(bmi.category)).toBe('A');
    expect(layoutFor(percentage.category)).toBe('B');
    expect(WIDGET_VARIANT.A).toBe('split');
  });
});

describe('splitIntro', () => {
  it('keeps the first two sentences as the lede and the rest for below the calculator', () => {
    const { lede, rest } = splitIntro('15% of 200 is 30. That is the first question. The second is harder. And a third.');
    expect(lede).toBe('15% of 200 is 30. That is the first question.');
    expect(rest).toBe('The second is harder. And a third.');
  });

  it('does not split after e.g. or a decimal point', () => {
    const { lede } = splitIntro('Use units such as e.g. kilograms, or 22.9 as the answer. Second sentence here. Third.');
    expect(lede).toBe('Use units such as e.g. kilograms, or 22.9 as the answer. Second sentence here.');
  });

  it('puts every word of a real intro on the page exactly once', () => {
    const { lede, rest } = splitIntro(bmi.intro);
    expect(`${lede} ${rest}`.trim()).toBe(bmi.intro.trim());
  });
});

describe('maths rendering', () => {
  it('typesets a formula to HTML with MathML, at build time', () => {
    const html = renderLatex(String.raw`\frac{A}{100}\times B`);
    expect(html).toContain('class="katex"');
    expect(html).toContain('<math');
  });

  it('typesets $...$ and escapes everything else', () => {
    const html = renderMathText('if a < b then $x^2$ & more');
    expect(html).toContain('if a &lt; b then ');
    expect(html).toContain('class="katex"');
    expect(html).toContain(' &amp; more');
  });

  it('never throws on a broken formula', () => {
    expect(() => renderLatex(String.raw`\frac{`)).not.toThrow();
  });

  it('percentage ships a formula and a derivation with no stray control characters', () => {
    expect(percentage.formulaLatex).toBeTruthy();
    expect(percentage.derivation?.length).toBeGreaterThanOrEqual(3);
    for (const s of [percentage.formulaLatex!, ...percentage.derivation!]) expect(s).not.toMatch(/[\u0000-\u0008\u000b-\u001f]/); // oxlint-disable-line no-control-regex -- the point of this check
    // A formula that fails to parse would come back as red source text, which KaTeX marks with this class.
    expect(renderLatex(percentage.formulaLatex!, true)).not.toContain('katex-error');
    for (const s of percentage.derivation!) expect(renderMathText(s)).not.toContain('katex-error');
  });
});

describe('scenario tables', () => {
  it('computes every row with calculate() and includes the default scenario', () => {
    const table = scenarioTable(bmi)!;
    expect(table.rows).toHaveLength(bmi.scenarios!.length);
    expect(table.columns.map((c) => c.name)).toEqual(bmi.outputs.map((o) => o.name));
    expect(table.rows.find((r) => r.label.includes('default'))!.results.bmi).toBe('22.9');
    expect(table.rows.find((r) => r.label === '100 kg at 175 cm')!.results.category).toBe('Obese');
  });

  it('is null when a calculator has no scenarios', () => {
    expect(scenarioTable({ ...bmi, scenarios: undefined })).toBeNull();
  });

  it('every scenario of every published calculator calculates without an invalid input', () => {
    for (const c of getPublishableCalculators()) {
      for (const s of c.scenarios ?? []) {
        for (const input of c.inputs) {
          if (input.name in s.inputs) expect(input.validator.safeParse(s.inputs[input.name]).success, `${c.slug}: ${s.label}`).toBe(true);
        }
      }
    }
  });

  it('age scenarios depend only on the date of birth, so the table is stable', () => {
    const t = scenarioTable(age)!;
    expect(t.rows.length).toBeGreaterThan(2);
    expect(t.rows.every((r) => r.results.age)).toBe(true);
  });
});

describe('related links (rule 6: published pages only)', () => {
  it('never links to an unpublished calculator, even when relatedSlugs lists one, nor to itself', () => {
    for (const c of getPublishableCalculators()) {
      const linked = linkedCalculators(linksFor(c));
      expect(
        linked.every((r) => isPublished(r)),
        c.slug,
      ).toBe(true);
      expect(
        linked.some((r) => r.slug === c.slug),
        c.slug,
      ).toBe(false);
    }
  });

  it('fills up from other published calculators when the listed ones are unpublished', () => {
    // bmi lists only tier 2 and 3 calculators, which are unpublished at launch.
    expect(bmi.relatedSlugs.every((s) => !getPublishableCalculators().some((c) => c.slug === s))).toBe(true);
    expect(linkedCalculators(linksFor(bmi)).length).toBeGreaterThanOrEqual(4);
  });
});
