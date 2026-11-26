import { afterEach, describe, expect, it, vi } from 'vitest';
import bmi from '../src/calculators/bmi-calculator';
import mortgage from '../src/calculators/mortgage-calculator';
import { linkedCalculators, linksFor, subClusterOf } from '../src/lib/linking';
import { isPublished } from '../src/lib/registry';

describe('linksFor at launch (only the 5 Tier 1 calculators are live)', () => {
  it('links to the category hub when it renders', () => {
    expect(linksFor(bmi).hub?.href).toBe('/categories/health/');
    expect(linksFor(mortgage).hub?.href).toBe('/categories/finance/');
  });

  it('gives every page at least 4 other published calculators, because 4 exist', () => {
    for (const c of [bmi, mortgage]) {
      const linked = linkedCalculators(linksFor(c));
      expect(linked.length).toBeGreaterThanOrEqual(4);
      expect(new Set(linked.map((x) => x.slug)).size).toBe(linked.length);
      expect(linked.every(isPublished)).toBe(true);
    }
  });

  it('the finance pair link to each other as siblings, and neither links to itself', () => {
    const links = linksFor(mortgage);
    const all = [...links.siblings, ...links.start];
    expect(all.some((c) => c.slug === 'compound-interest-calculator')).toBe(true);
    expect(linkedCalculators(links).some((c) => c.slug === mortgage.slug)).toBe(false);
  });

  it('sub-cluster comes from the hub copy for hand-written pages', () => {
    expect(subClusterOf(mortgage)).toBe('Loans and mortgages');
    expect(subClusterOf(bmi)).toBe('Body measurements');
  });
});

describe('linksFor with every cohort on', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('a converter page gets its hub, at least 3 siblings in its own sub-cluster, and only published pages', async () => {
    vi.stubEnv('COHORT_2_PUBLISHED', 'true');
    vi.stubEnv('COHORT_3_PUBLISHED', 'true');
    vi.resetModules();
    const { linksFor: links, linkedCalculators: linked, subClusterOf: cluster } = await import('../src/lib/linking');
    const { getPublishableCalculators, isPublished: live } = await import('../src/lib/registry');
    const page = getPublishableCalculators().find((c) => c.slug === 'kg-to-pounds')!;
    expect(page).toBeDefined();

    const set = links(page);
    expect(set.hub?.href).toBe('/categories/conversion/');
    expect(set.clusterLabel).toBe('Weight');
    expect(set.siblings.length).toBeGreaterThanOrEqual(3);
    expect(set.siblings.every((c) => cluster(c) === 'Weight')).toBe(true);
    expect(set.siblings[0].slug).toBe('pounds-to-kg'); // the reverse pair comes first
    expect(linked(set).every(live)).toBe(true);
  }, 60000);

  it('inbound links are spread: no family member is linked from far more pages than the others', async () => {
    vi.stubEnv('COHORT_2_PUBLISHED', 'true');
    vi.stubEnv('COHORT_3_PUBLISHED', 'true');
    vi.resetModules();
    const { linksFor: links } = await import('../src/lib/linking');
    const { getPublishableCalculators } = await import('../src/lib/registry');
    const weight = getPublishableCalculators().filter((c) => c.subCluster === 'weight');
    const inbound = new Map(weight.map((c) => [c.slug, 0]));
    for (const c of weight) for (const s of links(c).siblings) if (inbound.has(s.slug)) inbound.set(s.slug, inbound.get(s.slug)! + 1);
    const counts = [...inbound.values()];
    expect(Math.min(...counts)).toBeGreaterThanOrEqual(2);
    expect(Math.max(...counts)).toBeLessThanOrEqual(14);
  }, 60000);
});
