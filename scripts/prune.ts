// Prompt 8, item 3: pages with zero impressions and zero clicks for 90 days get noindex.
//
//   npm run prune [-- --csv indexation.csv] [--today 2026-12-01] [--write]
//
// Without --write it only reports. With --write it adds the slugs to src/config/pruned.json, which the page template
// turns into <meta name="robots" content="noindex, follow"> and the sitemap builder leaves out. The pages stay built,
// crawlable and linked; nothing is deleted. Deleting is a separate act and uses 410 (src/config/gone.json).
import { readFileSync, writeFileSync } from 'node:fs';
import { parseCsv, pruneCandidates, slugOfUrl } from '../src/lib/indexation';
import { PRUNED } from '../src/lib/pruned';

const arg = (args: string[], name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

export default function main(args: string[]): number {
  const csv = arg(args, '--csv') ?? 'indexation.csv';
  const today = arg(args, '--today') ?? new Date().toISOString().slice(0, 10);
  const candidates = pruneCandidates(parseCsv(readFileSync(csv, 'utf8')), today);
  const slugs = candidates.map((r) => slugOfUrl(r.url)).filter((s): s is string => s !== null);
  const fresh = slugs.filter((s) => !PRUNED.has(s));

  console.log(
    `${candidates.length} page(s) with 0 impressions and 0 clicks over 90 days and at least 90 days in the sitemaps (${slugs.length} calculators; hubs and the home page are never pruned).`,
  );
  for (const s of slugs) console.log(`  ${PRUNED.has(s) ? '(already pruned)' : 'NEW'} ${s}`);
  if (args.includes('--write') && fresh.length) {
    const all = [...new Set([...PRUNED, ...fresh])].sort();
    writeFileSync('src/config/pruned.json', JSON.stringify({ slugs: all }, null, 2) + '\n');
    console.log(`Wrote ${all.length} slug(s) to src/config/pruned.json. Commit it through a pull request.`);
  } else if (fresh.length) console.log('Dry run. Re-run with --write to record them.');
  return 0;
}
