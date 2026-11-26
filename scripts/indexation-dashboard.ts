// Prompt 8, item 2: render the indexation dashboard from indexation.csv into reports/indexation.html.
//
//   npm run dashboard [-- --csv indexation.csv] [--out reports/indexation.html] [--today 2026-12-01]
//
// The output is a local file, git-ignored and never part of dist/. See renderDashboard() for why it is not a
// deployed /admin/indexation page (open question 12.10).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseCsv } from '../src/lib/indexation';
import { renderDashboard } from '../src/lib/indexation-dashboard';

const arg = (args: string[], name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

export default function main(args: string[]): number {
  const csv = arg(args, '--csv') ?? 'indexation.csv';
  const out = arg(args, '--out') ?? 'reports/indexation.html';
  const today = arg(args, '--today') ?? new Date().toISOString().slice(0, 10);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, renderDashboard(parseCsv(readFileSync(csv, 'utf8')), today));
  console.log(`Wrote ${out}. Open it from disk; do not deploy it.`);
  return 0;
}
