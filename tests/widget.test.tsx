import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import CalculatorWidget from '../src/components/calculator/CalculatorWidget';
import { toWidgetSpec } from '../src/lib/widget-spec';
import { getPublishableCalculators } from '../src/lib/registry';
import bmi from '../src/calculators/bmi-calculator';
import ohms from '../src/calculators/ohms-law-calculator';
import mortgage from '../src/calculators/mortgage-calculator';

const html = (config = bmi, variant: 'split' | 'compact' | 'stack' = 'split') =>
  renderToString(createElement(CalculatorWidget, { spec: toWidgetSpec(config), variant }));

describe('CalculatorWidget server render (rule 2: the answer is in the initial HTML)', () => {
  it('contains the default inputs and the default result, with no spinner or empty state', () => {
    const out = html();
    expect(out).toContain('value="70"');
    expect(out).toContain('value="175"');
    expect(out).toContain('>22.9<'); // default BMI
    expect(out).toContain('Healthy weight');
    expect(out).not.toMatch(/loading|spinner|skeleton/i);
  });

  it('shows the default result for every published calculator', () => {
    for (const c of getPublishableCalculators()) {
      const spec = toWidgetSpec(c);
      const out = renderToString(createElement(CalculatorWidget, { spec }));
      for (const o of c.outputs.filter((o) => o.highlight)) {
        const shown = spec.initialResults[o.name];
        expect(shown, `${c.slug}.${o.name}`).toBeTruthy();
        // renderToString escapes & < > " ', so compare against the escaped text.
        expect(out, c.slug).toContain(shown.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#x27;').replace(/"/g, '&quot;'));
      }
    }
  });

  it('computes the default result at build time from the config, in decimal', () => {
    expect(toWidgetSpec(mortgage).initialResults.monthlyPayment).toBe('$2,022.62');
  });

  it('offers a unit toggle only where unit inputs have exactly two choices', () => {
    expect(html(bmi)).toContain('aria-label="Units"');
    expect(html(bmi)).toContain('kg · cm');
    expect(html(bmi)).toContain('lb · in');
    expect(html(mortgage)).not.toContain('aria-label="Units"');
  });

  it('offers Reset and Copy buttons', () => {
    const out = html();
    expect(out).toContain('Clear all changes');
    expect(out).toContain('Copy results');
  });

  it('shows a Solve for dropdown only when the config defines solveFor', () => {
    expect(html(bmi)).not.toContain('Solve for');
    const solvable = { ...ohms, solveFor: 'voltage' };
    expect(html(solvable)).toContain('Solve for');
  });

  it('links every input to a label, and renders no error text before the person types', () => {
    const out = html();
    expect(out).toMatch(/<label[^>]*for="[^"]+-weight"/);
    // No input or select points at an error or a hint before the person types; the only description is the disabled
    // "Clear all changes" button's reason, which is not an error.
    expect(out).not.toMatch(/<(input|select)[^>]*aria-describedby/);
    expect(out.match(/aria-describedby/g)).toHaveLength(1);
    expect(out).toMatch(/data-toolbar="reset"[^>]*aria-disabled="true"[^>]*aria-describedby=/);
    expect(out).toContain('Nothing has changed yet.');
    expect(out).not.toContain('aria-invalid');
  });

  it('hands the island plain data only: nothing that Astro could not serialise', () => {
    const spec = toWidgetSpec(bmi);
    expect(() => JSON.stringify(spec)).not.toThrow();
    expect(JSON.stringify(spec)).not.toContain('validator');
  });
});
