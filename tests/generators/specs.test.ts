import { describe, expect, it } from 'vitest';
import { runWith } from '../../src/lib/calc-utils';
import { defineCalculator, type Spec } from '../../src/lib/spec';
import { generated, handWritten, isPublished, registry } from '../../src/lib/registry';

// Every generator that exports SPECS (all except units.ts) is tested the same way: each spec carries its own
// known answers, so adding a calculator to a generator adds its tests.
const modules = import.meta.glob<{ SPECS?: Spec[] }>('../../src/generators/*.ts', { eager: true });
const groups = Object.entries(modules)
  .filter(([, m]) => Array.isArray(m.SPECS))
  .map(([path, m]) => ({ name: path.split('/').pop()!.replace('.ts', ''), specs: m.SPECS! }));

describe('generator specs', () => {
  it('there is at least one spec-based generator', () => {
    expect(groups.length).toBeGreaterThan(0);
  });

  for (const { name, specs } of groups) {
    describe(name, () => {
      const configs = specs.map(defineCalculator);

      it('every slug, title, description and h1 is unique, and no slug collides with a hand-written page', () => {
        for (const field of ['slug', 'title', 'metaDescription', 'h1'] as const) {
          expect(new Set(configs.map((c) => c[field])).size, field).toBe(configs.length);
        }
        const hand = new Set(handWritten.map((c) => c.slug));
        expect(configs.filter((c) => hand.has(c.slug)).map((c) => c.slug)).toEqual([]);
      });

      it('every spec has at least 3 FAQ entries, 5 scenarios and 3 known answers, and a sensible intro', () => {
        for (const s of specs) {
          expect(s.faq.length, s.slug).toBeGreaterThanOrEqual(3);
          expect(s.scenarios.length, s.slug).toBeGreaterThanOrEqual(5);
          expect(s.checks.length, s.slug).toBeGreaterThanOrEqual(3);
        }
        for (const c of configs) {
          expect((c.intro.match(/[\p{L}\p{N}']+/gu) ?? []).length, c.slug).toBeGreaterThanOrEqual(150);
          expect(c.metaDescription.length, c.slug).toBeLessThanOrEqual(220);
        }
      });

      it('known answers: every check produces exactly the stated outputs', () => {
        for (const s of specs) {
          const config = configs.find((c) => c.slug === s.slug)!;
          for (const check of s.checks) {
            const out = runWith(config, check.inputs);
            for (const [key, value] of Object.entries(check.expect)) {
              expect(out[key], `${s.slug} ${JSON.stringify(check.inputs)} -> ${key}`).toBe(value);
            }
          }
        }
      });

      it('every output name is returned by calculate(), and the intro quotes the default result', () => {
        for (const c of configs) {
          const out = runWith(c, {});
          for (const o of c.outputs) expect(out[o.name], `${c.slug} ${o.name}`).toBeTypeOf('string');
          const highlight = c.outputs.find((o) => o.highlight) ?? c.outputs[0];
          expect(c.intro.includes(out[highlight.name]), c.slug).toBe(true);
        }
      });

      it('every scenario runs without producing NaN, Infinity or undefined', () => {
        for (const c of configs) {
          for (const sc of c.scenarios ?? []) {
            const out = runWith(c, sc.inputs);
            for (const v of Object.values(out)) expect(/NaN|Infinity|undefined/.test(v), `${c.slug} ${sc.label}: ${v}`).toBe(false);
          }
        }
      });

      it('related slugs that are listed exist somewhere in the registry', () => {
        const all = new Set(registry.valid.map((c) => c.slug));
        for (const c of configs) for (const r of c.relatedSlugs) expect(all.has(r), `${c.slug} -> ${r}`).toBe(true);
      });

      it('passes the quality gate inside the real registry, and is not live while its cohort is off', () => {
        const live = new Set(registry.valid.map((c) => c.slug));
        for (const c of configs) expect(live.has(c.slug), `${c.slug} excluded by the gate`).toBe(true);
        expect(generated.length).toBeGreaterThan(0);
        for (const c of configs) if (c.tier > 1) expect(isPublished(c), c.slug).toBe(false);
      });
    });
  }
});
