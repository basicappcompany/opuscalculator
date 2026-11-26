// Prompt 8, item 1: read the published sitemaps in dist/, ask Search Console about each URL, write indexation.csv.
//
//   npm run build && npm run indexation -- [--limit 1800] [--out indexation.csv]
//   npm run indexation -- --mock tests/fixtures/mock-indexation.csv      (dry run: no network, no credentials)
//
// Needs SEARCH_CONSOLE_CREDENTIALS (service account JSON, on your own machine only) and optionally
// SEARCH_CONSOLE_SITE (default https://opuscalculator.com/). Run it weekly after a build with the same COHORT_* flags
// as the deployed site. It never prints the credentials.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { CSV_COLUMNS, cohortOfSitemap, mergeRows, parseCsv, pickStale, toCsv, type IndexRow, type UrlToCheck } from '../src/lib/indexation';
import { SearchConsole, parseCredentials } from '../src/lib/search-console';
import { readSitemaps } from './dist-reader';

const HOST = 'https://opuscalculator.com';
const arg = (args: string[], name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const isoDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

export default async function main(args: string[]): Promise<number> {
  const out = arg(args, '--out') ?? 'indexation.csv';
  const limit = Number(arg(args, '--limit') ?? 1800);
  const mock = arg(args, '--mock');
  const today = arg(args, '--today') ?? isoDay(Date.now());

  const { files } = readSitemaps();
  const urls: UrlToCheck[] = files.flatMap((f) => f.paths.map((p) => ({ url: `${HOST}${p}`, cohort: cohortOfSitemap(f.name) })));
  if (!urls.length) {
    console.error('No URLs in the sitemaps under dist/. Run `npm run build` first.');
    return 1;
  }

  const existing = new Map<string, IndexRow>((existsSync(out) ? parseCsv(readFileSync(out, 'utf8')) : []).map((r) => [r.url, r]));
  const todo = pickStale(urls, existing, limit);

  const inspected = new Map<string, { coverageState: string; lastCrawlDate: string }>();
  let performance = new Map<string, { impressions: number; clicks: number }>();

  if (mock) {
    // Dry run: results come from a CSV file instead of Google. URLs the file does not mention are "URL is unknown to Google".
    const mocked = new Map(parseCsv(readFileSync(mock, 'utf8')).map((r) => [r.url, r]));
    for (const { url } of todo) {
      const m = mocked.get(url);
      inspected.set(url, { coverageState: m?.coverage_state ?? 'URL is unknown to Google', lastCrawlDate: m?.last_crawl_date ?? '' });
    }
    performance = new Map([...mocked].map(([url, r]) => [url, { impressions: r.impressions_90d, clicks: r.clicks_90d }]));
    console.log(`DRY RUN against ${mock}: no request was sent to Google.`);
  } else {
    const client = new SearchConsole(parseCredentials(process.env.SEARCH_CONSOLE_CREDENTIALS), process.env.SEARCH_CONSOLE_SITE ?? `${HOST}/`, fetch as never);
    const start = isoDay(Date.parse(`${today}T00:00:00Z`) - 90 * 86400000);
    performance = await client.performance(start, today);
    for (const { url } of todo) {
      try {
        inspected.set(url, await client.inspect(url));
      } catch (error) {
        console.error(`  ${url}: ${(error as Error).message.slice(0, 160)}`);
        break; // most likely the daily quota: keep what we have and stop
      }
    }
  }

  const rows = mergeRows(urls, existing, inspected, performance, today);
  writeFileSync(out, toCsv(rows));
  console.log(`${urls.length} URLs in the sitemaps, ${inspected.size} inspected this run, written to ${out} (columns: ${CSV_COLUMNS.join(', ')}).`);
  return 0;
}
