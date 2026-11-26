import { describe, expect, it } from 'vitest';
import { CATEGORIES } from '../src/lib/types';
import { isPublished, registry } from '../src/lib/registry';
import { HUB_CONTENT, HUB_MAX_WORDS, HUB_MIN_WORDS, getRenderableHubs, hubPath, hubWordCount, selectRenderableHubs } from '../src/lib/hubs';

const hubs = [...HUB_CONTENT.values()];

describe('hub copy', () => {
  it('has one hub per category, all 14', () => {
    expect(CATEGORIES).toHaveLength(14);
    expect([...HUB_CONTENT.keys()].sort()).toEqual([...CATEGORIES].sort());
  });

  it.each(hubs.map((h) => [h.category, hubWordCount(h)] as const))('%s has %i words, within 800 to 1,200', (_c, words) => {
    expect(words).toBeGreaterThanOrEqual(HUB_MIN_WORDS);
    expect(words).toBeLessThanOrEqual(HUB_MAX_WORDS);
  });

  it('titles and meta descriptions are unique and a sensible length', () => {
    expect(new Set(hubs.map((h) => h.title)).size).toBe(14);
    expect(new Set(hubs.map((h) => h.metaDescription)).size).toBe(14);
    for (const h of hubs) {
      expect(h.metaDescription.length).toBeGreaterThan(80);
      expect(h.metaDescription.length).toBeLessThanOrEqual(175);
      expect(h.title.length).toBeLessThanOrEqual(65);
    }
  });

  it('no paragraph is repeated between hubs', () => {
    const seen = new Set<string>();
    for (const h of hubs) {
      for (const p of h.sections.flatMap((s) => s.paragraphs)) {
        expect(seen.has(p)).toBe(false);
        seen.add(p);
      }
    }
  });

  it('every slug in a hub refers to a calculator in the registry and its own category', () => {
    for (const h of hubs) {
      const slugs = [...h.subclusters.flatMap((s) => s.slugs), ...h.featured.map((f) => f.slug), ...h.guide.map((g) => g.slug)];
      for (const slug of slugs) {
        const c = registry.valid.find((x) => x.slug === slug);
        expect(c, `${h.category}: unknown slug ${slug}`).toBeDefined();
        expect(c?.category, `${slug} is in the wrong hub`).toBe(h.category);
      }
    }
  });

  it('featured blurbs are 2 to 3 sentences', () => {
    for (const f of hubs.flatMap((h) => h.featured)) {
      const sentences = f.blurb.split(/(?<=[.!?])\s+/).length;
      expect(sentences, f.slug).toBeGreaterThanOrEqual(2);
      expect(sentences, f.slug).toBeLessThanOrEqual(3);
    }
  });
});

describe('which hubs render', () => {
  it('renders exactly the categories that have a published calculator', () => {
    const withPublished = new Set(registry.valid.filter(isPublished).map((c) => c.category));
    expect(
      getRenderableHubs()
        .map((h) => h.category)
        .sort(),
    ).toEqual([...withPublished].sort());
  });

  it('hubPath only returns a path for a rendered hub (rule 6)', () => {
    expect(hubPath('finance')).toBe('/categories/finance/');
    expect(hubPath('chemistry')).toBeUndefined();
  });

  it('skips a hub with no published calculators, however long its copy', () => {
    expect(selectRenderableHubs(hubs, () => 0)).toEqual([]);
  });

  it('throws, failing the build, when a hub with calculators has under 800 words', () => {
    const short = { ...hubs[0], lede: 'Too short.', sections: [] };
    expect(() => selectRenderableHubs([short], () => 3)).toThrow(/needs at least 800/);
  });
});
