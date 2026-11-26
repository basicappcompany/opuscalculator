import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checkJsonLd } from '../scripts/prelaunch-audit';

const page = (graph: unknown[], context = 'https://schema.org') =>
  `<script type="application/ld+json">${JSON.stringify({ '@context': context, '@graph': graph })}</script>`;

const app = {
  '@type': 'WebApplication',
  name: 'BMI',
  url: 'https://opuscalculator.com/x/',
  applicationCategory: 'HealthApplication',
  offers: { '@type': 'Offer', price: '0' },
};
const faq = { '@type': 'FAQPage', mainEntity: [{ '@type': 'Question', name: 'Q?', acceptedAnswer: { '@type': 'Answer', text: 'A.' } }] };
const crumbs = {
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://opuscalculator.com/' },
    { '@type': 'ListItem', position: 2, name: 'BMI' },
  ],
};

describe('JSON-LD structure check (item 11.4)', () => {
  it('passes a complete calculator graph, with a review node', () => {
    expect(checkJsonLd(page([app, { '@type': 'WebPage', lastReviewed: '2026-11-22' }, faq, crumbs]))).toEqual([]);
  });

  it('reports a missing block, bad JSON and a wrong context', () => {
    expect(checkJsonLd('<html></html>')).toEqual(['no JSON-LD block']);
    expect(checkJsonLd('<script type="application/ld+json">{nope</script>')).toEqual(['JSON-LD does not parse']);
    expect(checkJsonLd(page([app], 'http://example.com')).join()).toMatch(/@context/);
  });

  it('reports missing required fields for each type', () => {
    expect(checkJsonLd(page([{ '@type': 'WebApplication', name: 'x' }])).join()).toMatch(/no url.*no applicationCategory.*offers\.price/);
    expect(checkJsonLd(page([{ '@type': 'FAQPage', mainEntity: [{ '@type': 'Question', name: 'Q?' }] }])).join()).toMatch(/no name or answer text/);
    expect(checkJsonLd(page([{ '@type': 'FAQPage', mainEntity: [] }])).join()).toMatch(/no questions/);
    expect(checkJsonLd(page([{ '@type': 'BreadcrumbList', itemListElement: [{ position: 2, name: 'a', item: 'u' }] }])).join()).toMatch(/wrong position/);
    expect(
      checkJsonLd(
        page([
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { position: 1, name: 'a' },
              { position: 2, name: 'b' },
            ],
          },
        ]),
      ).join(),
    ).toMatch(/non-final breadcrumb has no item/);
    expect(checkJsonLd(page([{ '@type': 'WebPage' }])).join()).toMatch(/no lastReviewed/);
  });
});

describe('decimal.js everywhere (item 11.10)', () => {
  const files = ['src/calculators', 'src/generators'].flatMap((dir) =>
    readdirSync(dir)
      .filter((f) => f.endsWith('.ts'))
      .map((f) => `${dir}/${f}`),
  );

  it('no calculator or generator parses a typed value with parseFloat or parseInt (that is how 0.1 + 0.2 sneaks in)', () => {
    const hits = files.flatMap((f) =>
      readFileSync(f, 'utf8')
        .split(/\r?\n/)
        .map((line, i) => ({ f, i: i + 1, line }))
        .filter(({ line }) => /\bparse(Float|Int)\s*\(/.test(line))
        .map(({ f, i }) => `${f}:${i}`),
    );
    expect(hits).toEqual([]);
  });

  it('every .toNumber() on a Decimal in a calculator is for a count that was rounded first or is an integer by nature', () => {
    // Reviewed on 2026-11-23: month counts, day counts, minutes, dice, flips. A new use must be added here on purpose.
    const reviewed = new Set(['cm-to-inches.ts', 'loan-calculator.ts', 'mortgage-calculator.ts', 'everyday.ts', 'finance.ts', 'health.ts']);
    const outside = files.filter((f) => /\.toNumber\(\)/.test(readFileSync(f, 'utf8')) && !reviewed.has(f.split('/').pop()!));
    expect(outside).toEqual([]);
  });
});
