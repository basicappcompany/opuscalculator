import { describe, expect, it } from 'vitest';
import generate, { HANDWRITTEN_PAIRS } from '../../src/generators/units';
import { runWith } from '../../src/lib/calc-utils';
import { D } from '../../src/lib/decimal';
import { generated, getPublishableCalculators, handWritten, isPublished, registry } from '../../src/lib/registry';

const configs = generate();
const by = (slug: string) => {
  const c = configs.find((x) => x.slug === slug);
  if (!c) throw new Error(`no generated page ${slug}`);
  return c;
};
const run = (slug: string, value: number | string) => runWith(by(slug), { value }).result;
const wordCount = (text: string) => (text.match(/[\p{L}\p{N}']+/gu) ?? []).length;

describe('units generator: the catalogue', () => {
  it('makes every pair inside the ten families', () => {
    // length 9, weight 8, volume 11, area 9, speed 5, time 7, digital 10, pressure 7, energy 8 (n*(n-1) each),
    // minus the hand-written cm-to-inches, plus 6 temperature pairs
    const n = (k: number) => k * (k - 1);
    expect(configs).toHaveLength(n(9) + n(8) + n(11) + n(9) + n(5) + n(7) + n(10) + n(7) + n(8) - 1 + 6);
  });

  it('has the example slugs from the plan, and not the one that is hand-written', () => {
    const slugs = new Set(configs.map((c) => c.slug));
    for (const s of ['kg-to-pounds', 'celsius-to-fahrenheit', 'mph-to-kph', 'gigabytes-to-megabytes']) expect(slugs.has(s)).toBe(true);
    expect(slugs.has('cm-to-inches')).toBe(false);
    for (const h of HANDWRITTEN_PAIRS) expect(handWritten.some((c) => c.slug === h)).toBe(true);
  });

  it('every slug, title, description and h1 is unique, and no slug collides with a hand-written page', () => {
    for (const field of ['slug', 'title', 'metaDescription', 'h1'] as const) {
      expect(new Set(configs.map((c) => c[field])).size, field).toBe(configs.length);
    }
    const hand = new Set(handWritten.map((c) => c.slug));
    expect(configs.filter((c) => hand.has(c.slug))).toEqual([]);
  });

  it('all pass the quality gate inside the real registry (nothing is silently excluded)', () => {
    expect(registry.excluded).toEqual([]);
    expect(registry.valid).toHaveLength(handWritten.length + generated.length);
  });

  it('tiers: common pairs are Tier 2, the rest Tier 3, and nothing is live while those cohorts are off', () => {
    expect(by('kg-to-pounds').tier).toBe(2);
    expect(by('celsius-to-fahrenheit').tier).toBe(2);
    expect(by('stone-to-mg').tier).toBe(3);
    expect(configs.every((c) => c.publish && c.tier >= 2)).toBe(true);
    expect(configs.some(isPublished)).toBe(false);
    expect(getPublishableCalculators().some((c) => c.category === 'conversion')).toBe(false);
  });

  it('is in the conversion category, grouped by family', () => {
    expect(new Set(configs.map((c) => c.category))).toEqual(new Set(['conversion']));
    expect(new Set(configs.map((c) => c.subCluster))).toEqual(
      new Set(['length', 'weight', 'volume', 'area', 'speed', 'time', 'digital-storage', 'pressure', 'energy', 'temperature']),
    );
  });

  it('copy: intro is at least 150 words, FAQ at least 4, related links point at real pages', () => {
    const slugs = new Set(configs.map((c) => c.slug));
    for (const c of configs) {
      expect(wordCount(c.intro), c.slug).toBeGreaterThanOrEqual(150);
      expect(c.faq.length, c.slug).toBeGreaterThanOrEqual(4);
      expect(c.relatedSlugs.length, c.slug).toBeGreaterThan(0);
      for (const r of c.relatedSlugs) expect(slugs.has(r), `${c.slug} -> ${r}`).toBe(true);
    }
  });

  it('the intro opens with the answer for the default input', () => {
    const c = by('kg-to-pounds');
    expect(c.intro.startsWith('10 kilograms is 22.0462 pounds.')).toBe(true);
    expect(runWith(c, {}).result).toBe('22.046226');
  });

  it('is deterministic: two runs produce identical copy', () => {
    expect(generate().map((c) => c.intro)).toEqual(configs.map((c) => c.intro));
  });
});

describe('units generator: known values (exact definitions)', () => {
  it('length, weight and volume', () => {
    expect(run('inches-to-mm', 1)).toBe('25.4');
    expect(run('miles-to-km', 1)).toBe('1.609344');
    expect(run('feet-to-meters', 100)).toBe('30.48');
    expect(run('pounds-to-kg', 1)).toBe('0.45359237');
    expect(run('stone-to-pounds', 1)).toBe('14');
    expect(run('gallons-to-liters', 1)).toBe('3.7854118');
    expect(run('cups-to-fluid-ounces', 1)).toBe('8');
    expect(run('tablespoons-to-teaspoons', 1)).toBe('3');
  });

  it('speed, time, energy, pressure', () => {
    expect(run('mph-to-kph', 60)).toBe('96.56064');
    expect(run('knots-to-kph', 1)).toBe('1.852');
    expect(run('hours-to-minutes', 2.5)).toBe('150');
    expect(run('days-to-hours', 1)).toBe('24');
    expect(run('kwh-to-joules', 1)).toBe('3,600,000');
    expect(run('kcal-to-calories', 1)).toBe('1,000');
    expect(run('atmospheres-to-pascals', 1)).toBe('101,325');
    expect(run('psi-to-kilopascals', 10)).toBe('68.947573');
  });

  it('digital storage: decimal and binary prefixes differ', () => {
    expect(run('gigabytes-to-megabytes', 1)).toBe('1,000');
    expect(run('gibibytes-to-mebibytes', 1)).toBe('1,024');
    expect(run('gigabytes-to-gibibytes', 1)).toBe('0.93132257');
    expect(run('bytes-to-bits', 1)).toBe('8');
  });

  it('temperature has an offset, not just a scale', () => {
    expect(run('celsius-to-fahrenheit', 100)).toBe('212');
    expect(run('celsius-to-fahrenheit', 0)).toBe('32');
    expect(run('celsius-to-fahrenheit', -40)).toBe('-40');
    expect(run('fahrenheit-to-celsius', 212)).toBe('100');
    expect(run('kelvin-to-celsius', 0)).toBe('-273.15');
    expect(run('celsius-to-kelvin', 0)).toBe('273.15');
    expect(run('fahrenheit-to-kelvin', 32)).toBe('273.15');
    expect(run('kelvin-to-fahrenheit', 273.15)).toBe('32');
  });

  it('uses exact decimal arithmetic, so 0.3 kg is 300 g and not 299.99999999999994', () => {
    expect(run('kg-to-grams', '0.3')).toBe('300');
    expect(run('grams-to-kg', '0.3')).toBe('0.0003');
  });

  it('A to B then B to A returns the starting value (to the 8 digits displayed)', () => {
    const slugs = new Set(configs.map((c) => c.slug));
    let checked = 0;
    for (const c of configs) {
      const [from, to] = c.slug.split('-to-');
      const back = `${to}-to-${from}`;
      if (!slugs.has(back) || c.subCluster === 'temperature') continue;
      const forward = run(c.slug, 1000).replace(/,/g, '');
      const result = run(back, forward).replace(/,/g, '');
      const err = new D(result).minus(1000).abs().div(1000);
      expect(err.lt('0.000001'), `${c.slug}: ${forward} -> ${result}`).toBe(true);
      checked++;
    }
    expect(checked).toBeGreaterThan(400);
  });
});
