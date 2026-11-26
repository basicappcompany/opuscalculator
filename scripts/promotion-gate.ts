// Prompt 8, item 4: evaluate the promotion gate from indexation.csv and write src/config/promotion-gate.json.
//
//   npm run gate [-- --csv indexation.csv] [--out src/config/promotion-gate.json] [--now 2026-12-01T00:00:00Z]
//
// src/config/rollout.ts refuses to start a build with COHORT_2_PUBLISHED or COHORT_3_PUBLISHED set to true unless that
// file says the promotion is allowed and is at most 14 days old. Commit the file through a pull request when you
// intend to promote; the evidence is in the diff.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { demotionCandidates, parseCsv, promotionGate, summarize, type GateFile } from '../src/lib/indexation';

const arg = (args: string[], name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const pct = (x: number): string => `${(x * 100).toFixed(1)}%`;

export default function main(args: string[]): number {
  const csv = arg(args, '--csv') ?? 'indexation.csv';
  const out = arg(args, '--out') ?? 'src/config/promotion-gate.json';
  const when = arg(args, '--now') ?? new Date().toISOString();
  const rows = parseCsv(readFileSync(csv, 'utf8'));
  const summary = summarize(rows);
  const d2 = promotionGate(summary, 2);
  const d3 = promotionGate(summary, 3);

  const gate: GateFile = { generatedAt: when, allowed: { 2: d2.allowed, 3: d3.allowed }, reasons: { 2: d2.reasons, 3: d3.reasons }, rows: rows.length };
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(gate, null, 2) + '\n');

  console.log(`Evaluated ${rows.length} rows from ${csv}`);
  for (const c of [1, 2, 3] as const) {
    const s = summary.byCohort[c];
    console.log(`  cohort ${c}: ${s.total} pages, ${s.indexed} indexed (${pct(s.rate)}), ${s.withClicks} with clicks (${pct(s.clickShare)})`);
  }
  for (const d of [d2, d3])
    console.log(`Promote cohort ${d.cohort}: ${d.allowed ? 'ALLOWED' : 'NOT allowed'}${d.reasons.length ? `\n    - ${d.reasons.join('\n    - ')}` : ''}`);
  const demote = demotionCandidates(summary);
  if (demote.length)
    console.log(`Below 30% indexation (demotion rule, Appendix B): cohort ${demote.join(', ')}. Switch the worst clusters off and set them to noindex.`);
  console.log(`Wrote ${out}`);
  return 0;
}
