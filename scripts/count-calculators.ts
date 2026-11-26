// Prompt 5: totals per category, per cohort, and the pages that failed the quality gate, with reasons.
//   npm run count
// Cohort N is tier N (working assumption, open question 12.4). "Live" means isPublished(): publish is true AND
// that cohort's flag is on, so by default only Cohort 1 counts as live.
import { CATEGORIES } from '../src/lib/types';
import { isCohortPublished } from '../src/config/rollout';
import { generated, handWritten, isPublished, registry } from '../src/lib/registry';
import { similarPairs } from '../src/lib/quality-gate';

const pad = (v: string | number, n: number) => String(v).padEnd(n);
const num = (v: string | number, n: number) => String(v).padStart(n);

export default function main(): number {
  const all = [
    ...registry.valid.map((c) => ({ category: c.category, tier: c.tier, live: isPublished(c), ok: true })),
    ...registry.excluded.map((e) => ({ category: e.category, tier: e.tier, live: false, ok: false })),
  ];

  console.log('Calculators in the registry');
  console.log(`  hand-written: ${handWritten.length}, generated: ${generated.length}, total: ${all.length}`);
  console.log(`  passed the gate: ${registry.valid.length}, failed: ${registry.excluded.length}`);
  console.log(`  live now (published and cohort flag on): ${registry.valid.filter(isPublished).length}`);
  console.log('');

  const withRefs = registry.valid.filter((c) => (c.references?.length ?? 0) > 0);
  const liveWithRefs = registry.valid.filter((c) => isPublished(c) && (c.references?.length ?? 0) > 0);
  console.log(
    `With verified references (item 20.12): ${withRefs.length} of ${registry.valid.length}; live: ${liveWithRefs.length} of ${registry.valid.filter(isPublished).length}`,
  );

  const flagged = registry.valid.filter((c) => c.audit);
  console.log(
    `Flagged by the catalog audit (src/config/catalog-audit.ts): ${flagged.length} (weak ${flagged.filter((c) => c.audit?.grade === 'weak').length}, niche ${flagged.filter((c) => c.audit?.grade === 'niche').length}), live: ${flagged.filter(isPublished).length}`,
  );
  const codes = new Map<string, number>();
  for (const c of flagged) codes.set(c.audit!.code, (codes.get(c.audit!.code) ?? 0) + 1);
  console.log(
    `  by code: ${[...codes]
      .sort()
      .map(([k, n]) => `${k} ${n}`)
      .join(', ')}`,
  );
  console.log('');

  console.log('Per category');
  console.log(`  ${pad('category', 15)}${num('total', 7)}${num('passed', 8)}${num('live', 6)}${num('tier1', 7)}${num('tier2', 7)}${num('tier3', 7)}`);
  for (const category of CATEGORIES) {
    const rows = all.filter((r) => r.category === category);
    const t = (n: number) => rows.filter((r) => r.tier === n).length;
    console.log(
      `  ${pad(category, 15)}${num(rows.length, 7)}${num(rows.filter((r) => r.ok).length, 8)}${num(rows.filter((r) => r.live).length, 6)}${num(t(1), 7)}${num(t(2), 7)}${num(t(3), 7)}`,
    );
  }
  console.log('');

  console.log('Per cohort (cohort N = tier N)');
  console.log(`  ${pad('cohort', 8)}${pad('flag', 8)}${num('total', 7)}${num('passed', 8)}${num('live', 6)}`);
  for (const n of [1, 2, 3] as const) {
    const rows = all.filter((r) => r.tier === n);
    console.log(
      `  ${pad(n, 8)}${pad(isCohortPublished(n) ? 'on' : 'off', 8)}${num(rows.length, 7)}${num(rows.filter((r) => r.ok).length, 8)}${num(rows.filter((r) => r.live).length, 6)}`,
    );
  }
  console.log('');

  const sets = registry.valid.map((c) => new Set(c.intro.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? []));
  let best = { j: 0, a: '', b: '' };
  similarPairs(sets, 0.1).forEach((list, i) =>
    list.forEach((m) => {
      if (m.jaccard > best.j) best = { j: m.jaccard, a: registry.valid[i].slug, b: registry.valid[m.other].slug };
    }),
  );
  console.log(`Closest pair of intros among passing pages: ${best.j.toFixed(3)} (${best.a} and ${best.b}); the limit is 0.3`);
  console.log('');

  console.log(`Failed the quality gate: ${registry.excluded.length}`);
  for (const e of registry.excluded.slice(0, 40))
    console.log(
      `  ${e.slug} (${e.category}, tier ${e.tier}): ${e.reasons.slice(0, 2).join(' | ')}${e.reasons.length > 2 ? ` (+${e.reasons.length - 2} more)` : ''}`,
    );
  if (registry.excluded.length > 40) console.log(`  ... and ${registry.excluded.length - 40} more`);
  return 0;
}
