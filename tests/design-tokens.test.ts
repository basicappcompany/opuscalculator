import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import bmi from '../src/calculators/bmi-calculator';
import mortgage from '../src/calculators/mortgage-calculator';
import CalculatorWidget from '../src/components/calculator/CalculatorWidget';
import { WIDGET_CHUNK_BUDGET, WIDGET_CLOSURE_BUDGET, importsOf, measure } from '../scripts/check-bundle-size';
import { toWidgetSpec } from '../src/lib/widget-spec';

const css = readFileSync('src/styles/tokens.css', 'utf8');

/** Custom properties declared inside the block that starts at `opener`. */
function block(opener: string): Record<string, string> {
  const start = css.indexOf(opener);
  if (start < 0) throw new Error(`no block ${opener}`);
  const open = css.indexOf('{', start);
  let depth = 0;
  let end = open;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}' && --depth === 0) {
      end = i;
      break;
    }
  }
  const out: Record<string, string> = {};
  for (const m of css.slice(open + 1, end).matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

const light = block('@theme static');
const dark = { ...light, ...block(":root[data-theme='dark']") };
const darkFromMedia = { ...light, ...block(":root:not([data-theme='light'])") };

const lum = (hex: string): number => {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string): number => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe('design tokens (Prompt 13)', () => {
  it('defines every token the plan names, for light and dark', () => {
    for (const name of ['bg', 'fg', 'muted', 'accent', 'accent-fg', 'danger', 'success', 'border', 'card']) {
      expect(light[`--color-${name}`], name).toMatch(/^#[0-9a-f]{6}$/i);
      expect(dark[`--color-${name}`], name).toMatch(/^#[0-9a-f]{6}$/i);
    }
    for (const step of ['xs', 'sm', 'base', 'lg', '2xl', '4xl']) expect(light[`--text-${step}`], step).toMatch(/rem$/);
    expect(light['--text-xs']).toBe('0.75rem');
    expect(light['--text-4xl']).toBe('2.25rem');
    for (const r of ['sm', 'md', 'lg', 'full']) expect(light[`--radius-${r}`], r).toBeTruthy();
    expect(light['--radius-sm']).toBe('4px');
    expect(light['--radius-md']).toBe('8px');
    expect(light['--radius-lg']).toBe('16px');
    for (const s of ['sm', 'md', 'lg']) expect(light[`--shadow-${s}`], s).toBeTruthy();
    expect(light['--font-sans']).toMatch(/system-ui/);
    expect(light['--font-mono']).toMatch(/monospace/);
    for (const n of [1, 2, 3, 4, 6, 8, 12, 16]) expect(css).toContain(`--space-${n}:`);
  });

  it('the system-dark block and the chosen-dark block hold the same colours, so the two paths cannot drift', () => {
    for (const k of Object.keys(light).filter((k) => k.startsWith('--color-'))) expect(darkFromMedia[k], k).toBe(dark[k]);
  });

  const textPairs: [string, string][] = [
    ['--color-fg', '--color-bg'],
    ['--color-fg', '--color-card'],
    ['--color-muted', '--color-bg'],
    ['--color-muted', '--color-card'],
    ['--color-muted', '--color-accent-soft'],
    ['--color-accent-strong', '--color-card'],
    ['--color-accent-strong', '--color-accent-soft'],
    ['--color-accent-strong', '--color-bg'],
    ['--color-accent', '--color-card'],
    ['--color-accent-fg', '--color-accent'],
    ['--color-danger', '--color-card'],
    ['--color-danger', '--color-danger-soft'],
    ['--color-warn', '--color-warn-soft'],
    ['--color-success', '--color-card'],
  ];
  for (const [name, theme] of [
    ['light', light],
    ['dark', dark],
  ] as const) {
    it.each(textPairs)(`${name}: %s on %s is at least 4.5:1`, (fg, bg) => {
      expect(contrast(theme[fg], theme[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    });

    it(`${name}: result-card white text on both ends of its gradient is at least 4.5:1`, () => {
      expect(contrast(theme['--color-hero-fg'], theme['--color-hero-from'])).toBeGreaterThanOrEqual(4.5);
      expect(contrast(theme['--color-hero-fg'], theme['--color-hero-to'])).toBeGreaterThanOrEqual(4.5);
    });

    it(`${name}: control outlines and the focus ring are at least 3:1 against the card and the page`, () => {
      expect(contrast(theme['--color-border-strong'], theme['--color-card'])).toBeGreaterThanOrEqual(3);
      expect(contrast(theme['--color-border-strong'], theme['--color-bg'])).toBeGreaterThanOrEqual(3);
      expect(contrast(theme['--color-accent'], theme['--color-card'])).toBeGreaterThanOrEqual(3);
      expect(contrast(theme['--color-accent'], theme['--color-bg'])).toBeGreaterThanOrEqual(3);
    });
  }
});

describe('component files use tokens, not raw values', () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(astro|tsx)$/.test(name)) files.push(full);
    }
  };
  walk('src/components');
  walk('src/layouts');
  walk('src/pages');

  it('has no hex colour or px/rem length in any component, layout or page file', () => {
    const offenders: string[] = [];
    for (const f of files) {
      const code = readFileSync(f, 'utf8')
        .replace(/<script[\s\S]*?<\/script>/g, '') // inline scripts have their own rules
        .replace(/\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->/g, '');
      for (const m of code.matchAll(/#[0-9a-fA-F]{3,8}\b|(?<![\w-])\d+(?:\.\d+)?(?:px|rem)\b/g)) {
        // `href="#main"` and `#calculator` are fragments, not colours: only flag a hash that is all hex digits and 3, 4, 6 or 8 long.
        if (m[0].startsWith('#') && !/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(m[0])) continue;
        if (m[0].startsWith('#') && /^#[a-z]{3,8}$/.test(m[0]) && !/^#[0-9a-f]+$/i.test(m[0])) continue;
        offenders.push(`${f}: ${m[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('widget HTML (states, announcements, skip link target)', () => {
  const html = (config = mortgage) => renderToString(createElement(CalculatorWidget, { spec: toWidgetSpec(config), variant: 'split' }));

  it('is the skip-link target and shows the result in a gradient card with a polite, atomic live region', () => {
    const out = html();
    expect(out).toContain('id="calculator"');
    expect(out).toContain('result-card');
    expect(out).toMatch(/<output[^>]*aria-live="polite"[^>]*aria-atomic="true"/);
    expect(out).toContain('Monthly payment (principal and interest): $2,022.62'); // the announcement text, in the server HTML
    expect(out).toContain('>$2,022.62<'); // the visible default result, unchanged
  });

  it('every typed input is aria-required, and none starts stale or in error', () => {
    const out = html(bmi);
    expect(out).toContain('aria-required="true"');
    expect(out).not.toContain('data-stale');
    expect(out).not.toContain('stale');
    expect(out).not.toContain('aria-invalid');
  });
});

describe('bundle budget check', () => {
  it('reads the static imports of a built chunk', () => {
    expect(importsOf('import{a as b}from"./format.abc.js";import"./units.def.js";export{x}')).toEqual(['format.abc.js', 'units.def.js']);
  });

  it('counts the widget chunk, its code and the largest calculator, and keeps the React runtime separate', () => {
    const files = ['CalculatorWidget.h1.js', 'format.h2.js', 'client.h3.js', 'react.h4.js', 'mortgage-calculator.h5.js', 'calc-utils.h6.js'];
    const src: Record<string, string> = {
      'CalculatorWidget.h1.js': 'import"./react.h4.js";import"./format.h2.js";',
      'format.h2.js': '',
      'client.h3.js': '',
      'react.h4.js': '',
      'mortgage-calculator.h5.js': 'import"./calc-utils.h6.js";',
      'calc-utils.h6.js': '',
    };
    const sizes: Record<string, number> = {
      'CalculatorWidget.h1.js': 10,
      'format.h2.js': 5,
      'client.h3.js': 100,
      'react.h4.js': 3,
      'mortgage-calculator.h5.js': 2,
      'calc-utils.h6.js': 20,
    };
    const r = measure(
      files,
      (f) => src[f],
      (f) => sizes[f],
    );
    expect(r.widget).toEqual({ file: 'CalculatorWidget.h1.js', gzip: 10 });
    expect(r.closure.map((c) => c.file).sort()).toEqual(['CalculatorWidget.h1.js', 'calc-utils.h6.js', 'format.h2.js']);
    expect(r.framework.map((c) => c.file).sort()).toEqual(['client.h3.js', 'react.h4.js']);
    expect(r.largestCalculator.file).toBe('mortgage-calculator.h5.js');
  });

  it("keeps the plan's 45 KB for the widget chunk and a larger guard for everything it needs", () => {
    expect(WIDGET_CHUNK_BUDGET).toBe(45 * 1024);
    expect(WIDGET_CLOSURE_BUDGET).toBeGreaterThan(WIDGET_CHUNK_BUDGET);
  });
});
