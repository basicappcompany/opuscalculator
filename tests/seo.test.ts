import { describe, expect, it } from 'vitest';
import bmi from '../src/calculators/bmi-calculator';
import { registry, getPublishableCalculators } from '../src/lib/registry';
import { assertUniqueMeta, calculatorJsonLd, hubJsonLd, serializeJsonLd } from '../src/lib/seo';

const crumbs = [{ label: 'Home', href: '/' }, { label: 'Health', href: '/categories/health/' }, { label: bmi.h1 }];

describe('assertUniqueMeta', () => {
  it('passes for every published calculator', () => {
    expect(() => assertUniqueMeta(getPublishableCalculators())).not.toThrow();
  });

  it('every registered calculator, published or not, has a distinct title, description and h1', () => {
    expect(() => assertUniqueMeta(registry.valid)).not.toThrow();
  });

  it('fails the build on a duplicate title, naming both pages', () => {
    const dup = { ...bmi, slug: 'bmi-copy', metaDescription: 'something else', h1: 'Another h1' };
    expect(() => assertUniqueMeta([bmi, dup])).toThrow(/title of "bmi-copy" duplicates "bmi-calculator"/);
  });

  it('is case and whitespace insensitive', () => {
    const dup = { ...bmi, slug: 'bmi-copy', title: `  ${bmi.title.toUpperCase()} `, metaDescription: 'x', h1: 'y' };
    expect(() => assertUniqueMeta([bmi, dup])).toThrow(/title/);
  });
});

describe('calculatorJsonLd', () => {
  const ld = calculatorJsonLd(bmi, '/calculators/bmi-calculator/', crumbs);
  const byType = (t: string) => ld['@graph'].find((n) => n['@type'] === t) as Record<string, any>;

  it('has WebApplication, FAQPage and BreadcrumbList, plus a WebPage carrying the review date on a health (YMYL) page', () => {
    expect(ld['@graph'].map((n) => n['@type'])).toEqual(['WebApplication', 'WebPage', 'FAQPage', 'BreadcrumbList']);
  });

  it('WebApplication is free and on the canonical host', () => {
    const app = byType('WebApplication');
    expect(app.name).toBe(bmi.h1);
    expect(app.description).toBe(bmi.metaDescription);
    expect(app.url).toBe('https://opuscalculator.com/calculators/bmi-calculator/');
    expect(app.applicationCategory).toBe('HealthApplication');
    expect(app.offers).toEqual({ '@type': 'Offer', price: '0', priceCurrency: 'USD' });
  });

  it('FAQPage mirrors config.faq', () => {
    const faq = byType('FAQPage');
    expect(faq.mainEntity).toHaveLength(bmi.faq.length);
    expect(faq.mainEntity[0].name).toBe(bmi.faq[0].question);
    expect(faq.mainEntity[0].acceptedAnswer.text).toBe(bmi.faq[0].answer);
  });

  it('BreadcrumbList is positioned from 1 with absolute URLs', () => {
    const list = byType('BreadcrumbList').itemListElement;
    expect(list.map((i: any) => i.position)).toEqual([1, 2, 3]);
    expect(list[0].item).toBe('https://opuscalculator.com/');
    expect(list[1].item).toBe('https://opuscalculator.com/categories/health/');
    expect(list[2].item).toBeUndefined();
  });
});

describe('hubJsonLd', () => {
  it('lists exactly the items given as an ItemList', () => {
    const ld = hubJsonLd({ title: 't', metaDescription: 'd', h1: 'Health Calculators' }, '/categories/health/', [bmi], crumbs.slice(0, 2));
    const page = ld['@graph'][0] as Record<string, any>;
    expect(page['@type']).toBe('CollectionPage');
    expect(page.mainEntity.numberOfItems).toBe(1);
    expect(page.mainEntity.itemListElement[0].url).toBe('https://opuscalculator.com/calculators/bmi-calculator/');
  });
});

describe('serializeJsonLd', () => {
  it('escapes < so a string cannot close the script tag', () => {
    const out = serializeJsonLd({ a: '</script><b>' });
    expect(out).not.toContain('<');
    expect(JSON.parse(out).a).toBe('</script><b>');
  });
});
