/**
 * Prompt 8: pure logic for indexation monitoring, the pruning rule and the promotion gate. No network, no files:
 * scripts read and write the CSV and the JSON, these functions decide.
 */

export const CSV_COLUMNS = ['url', 'cohort', 'coverage_state', 'last_crawl_date', 'impressions_90d', 'clicks_90d', 'first_seen', 'checked_on'] as const;

export interface IndexRow {
  url: string;
  /** 1, 2 or 3 (cohort N is tier N). Home and hubs count as cohort 1. */
  cohort: 1 | 2 | 3;
  coverage_state: string;
  last_crawl_date: string;
  /** Search Analytics totals over the last 90 days. NOT in the URL Inspection API: they come from a second API. */
  impressions_90d: number;
  clicks_90d: number;
  /** ISO date this URL first appeared in a checked sitemap; the pruning clock starts here. */
  first_seen: string;
  checked_on: string;
}

// ---------------------------------------------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------------------------------------------

const quote = (v: string | number): string => {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(rows: readonly IndexRow[]): string {
  const lines = rows.map((r) => CSV_COLUMNS.map((c) => quote(r[c])).join(','));
  return [CSV_COLUMNS.join(','), ...lines].join('\n') + '\n';
}

/** Minimal RFC 4180 parser: quoted fields, doubled quotes, CRLF or LF. */
function parseRecords(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((f) => f !== '')) out.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((f) => f !== '')) out.push(row);
  return out;
}

/** Reads the CSV. Only url, cohort, coverage_state and last_crawl_date are required (the four columns in the plan). */
export function parseCsv(text: string): IndexRow[] {
  const records = parseRecords(text);
  if (!records.length) return [];
  const header = records[0].map((h) => h.trim());
  for (const required of ['url', 'cohort', 'coverage_state', 'last_crawl_date']) {
    if (!header.includes(required)) throw new Error(`indexation CSV is missing the "${required}" column`);
  }
  const at = (rec: string[], name: string): string => rec[header.indexOf(name)]?.trim() ?? '';
  return records.slice(1).map((rec, n) => {
    const cohort = Number(at(rec, 'cohort'));
    if (![1, 2, 3].includes(cohort)) throw new Error(`indexation CSV row ${n + 2}: cohort must be 1, 2 or 3, got "${at(rec, 'cohort')}"`);
    return {
      url: at(rec, 'url'),
      cohort: cohort as 1 | 2 | 3,
      coverage_state: at(rec, 'coverage_state'),
      last_crawl_date: at(rec, 'last_crawl_date'),
      impressions_90d: Number(at(rec, 'impressions_90d') || 0),
      clicks_90d: Number(at(rec, 'clicks_90d') || 0),
      first_seen: at(rec, 'first_seen'),
      checked_on: at(rec, 'checked_on'),
    };
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Indexation summary
// ---------------------------------------------------------------------------------------------------------------

/** Search Console coverage states that mean "in Google's index": "Submitted and indexed", "Indexed, not submitted in sitemap". */
export const isIndexed = (state: string): boolean => /^(submitted and )?indexed\b/i.test(state.trim());
/** The state the dashboard lists: Google fetched the page and chose not to index it (written with a hyphen or a dash). */
export const isCrawledNotIndexed = (state: string): boolean => /crawled\s*\W{1,3}\s*currently not indexed/i.test(state);

export interface CohortSummary {
  cohort: 1 | 2 | 3;
  total: number;
  indexed: number;
  /** indexed ÷ total, 0 when there are no pages. */
  rate: number;
  withClicks: number;
  /** pages with at least one organic click in the last 90 days ÷ total. */
  clickShare: number;
}

export interface IndexationSummary {
  total: number;
  indexed: number;
  byCohort: Record<1 | 2 | 3, CohortSummary>;
  crawledNotIndexed: IndexRow[];
}

export function summarize(rows: readonly IndexRow[]): IndexationSummary {
  const byCohort = {} as Record<1 | 2 | 3, CohortSummary>;
  for (const cohort of [1, 2, 3] as const) {
    const list = rows.filter((r) => r.cohort === cohort);
    const indexed = list.filter((r) => isIndexed(r.coverage_state)).length;
    const withClicks = list.filter((r) => r.clicks_90d > 0).length;
    byCohort[cohort] = {
      cohort,
      total: list.length,
      indexed,
      rate: list.length ? indexed / list.length : 0,
      withClicks,
      clickShare: list.length ? withClicks / list.length : 0,
    };
  }
  return {
    total: rows.length,
    indexed: rows.filter((r) => isIndexed(r.coverage_state)).length,
    byCohort,
    crawledNotIndexed: rows.filter((r) => isCrawledNotIndexed(r.coverage_state)),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Promotion gate (Appendix B, CLAUDE.md rule 5) and demotion
// ---------------------------------------------------------------------------------------------------------------

export const GATE_MIN_INDEXATION = 0.4;
export const GATE_MIN_CLICK_SHARE = 0.2;
export const DEMOTE_BELOW = 0.3;

export interface GateDecision {
  /** The cohort that may be promoted if `allowed`. */
  cohort: 2 | 3;
  allowed: boolean;
  reasons: string[];
}

const pct = (x: number): string => `${(x * 100).toFixed(1)}%`;

/**
 * Cohort 2 may publish only if cohort 1 is indexed above 40% AND at least 20% of its pages have organic clicks;
 * cohort 3 likewise against cohort 2. Strict "above" for indexation, "at least" for clicks, as written in the plan.
 * An empty previous cohort never passes: no data is not a pass.
 */
export function promotionGate(summary: IndexationSummary, cohort: 2 | 3): GateDecision {
  const prev = summary.byCohort[(cohort - 1) as 1 | 2];
  const reasons: string[] = [];
  if (prev.total === 0) reasons.push(`Cohort ${prev.cohort} has no pages in the data, so there is nothing to measure`);
  else {
    if (!(prev.rate > GATE_MIN_INDEXATION)) reasons.push(`Cohort ${prev.cohort} indexation is ${pct(prev.rate)}; it must be above ${pct(GATE_MIN_INDEXATION)}`);
    if (!(prev.clickShare >= GATE_MIN_CLICK_SHARE))
      reasons.push(`Only ${pct(prev.clickShare)} of cohort ${prev.cohort} pages have organic clicks; at least ${pct(GATE_MIN_CLICK_SHARE)} are needed`);
  }
  return { cohort, allowed: reasons.length === 0, reasons };
}

/** Cohorts whose indexation has fallen below 30% and should be switched off for the worst clusters (Appendix B). */
export const demotionCandidates = (summary: IndexationSummary): (1 | 2 | 3)[] =>
  ([1, 2, 3] as const).filter((c) => summary.byCohort[c].total > 0 && summary.byCohort[c].rate < DEMOTE_BELOW);

// ---------------------------------------------------------------------------------------------------------------
// Pruning
// ---------------------------------------------------------------------------------------------------------------

export const PRUNE_AFTER_DAYS = 90;
const dayMs = 86400000;
export const daysBetweenIso = (from: string, to: string): number => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / dayMs);

/**
 * Pages to set to noindex: zero impressions AND zero clicks over the last 90 days, and in the sitemaps for at least
 * 90 days (a new page has had no time to earn impressions). noindex keeps the page crawlable and linked; it is not
 * deleted. A page with no `first_seen` is never pruned.
 */
export function pruneCandidates(rows: readonly IndexRow[], today: string): IndexRow[] {
  return rows.filter((r) => r.first_seen !== '' && daysBetweenIso(r.first_seen, today) >= PRUNE_AFTER_DAYS && r.impressions_90d === 0 && r.clicks_90d === 0);
}

/** `/calculators/some-slug/` to `some-slug`, or null for hubs and the home page (those are never pruned). */
export function slugOfUrl(url: string): string | null {
  const m = /\/calculators\/([^/?#]+)\/?$/.exec(url);
  return m ? m[1] : null;
}

// ---------------------------------------------------------------------------------------------------------------
// Gate file read by the build
// ---------------------------------------------------------------------------------------------------------------

export interface GateFile {
  /** ISO timestamp of the evaluation, or null if it has never been run. */
  generatedAt: string | null;
  allowed: { 2: boolean; 3: boolean };
  reasons?: { 2: string[]; 3: string[] };
  rows?: number;
}

export const EMPTY_GATE: GateFile = { generatedAt: null, allowed: { 2: false, 3: false } };

/** How old the evaluation may be when a cohort is promoted. Indexation changes slowly; a stale pass is not a pass. */
export const GATE_MAX_AGE_DAYS = 14;

/**
 * Problems with the cohort flags a build was started with. Empty means the build may proceed. `skip` is the
 * local-only escape hatch for test builds; the caller decides when it is allowed (never on CI or Cloudflare Pages).
 */
export function checkPromotion(flags: { 1: boolean; 2: boolean; 3: boolean }, gate: GateFile, nowMs: number): string[] {
  const problems: string[] = [];
  const age = gate.generatedAt ? (nowMs - Date.parse(gate.generatedAt)) / dayMs : Infinity;
  for (const cohort of [2, 3] as const) {
    if (!flags[cohort]) continue;
    if (cohort === 3 && !flags[2]) problems.push('COHORT_3_PUBLISHED is true but COHORT_2_PUBLISHED is false: cohort 3 cannot publish before cohort 2');
    if (!gate.generatedAt)
      problems.push(`COHORT_${cohort}_PUBLISHED is true but the promotion gate has never been evaluated (run npm run gate against a real indexation.csv)`);
    else if (age > GATE_MAX_AGE_DAYS)
      problems.push(
        `COHORT_${cohort}_PUBLISHED is true but the gate was evaluated ${Math.floor(age)} days ago; re-run npm run gate (limit ${GATE_MAX_AGE_DAYS} days)`,
      );
    else if (!gate.allowed[cohort])
      problems.push(`COHORT_${cohort}_PUBLISHED is true but the gate says no: ${(gate.reasons?.[cohort] ?? []).join('; ') || 'not allowed'}`);
  }
  return problems;
}

// ---------------------------------------------------------------------------------------------------------------
// Merging a check run into the CSV
// ---------------------------------------------------------------------------------------------------------------

export interface UrlToCheck {
  url: string;
  cohort: 1 | 2 | 3;
}

/** Cohort of a sitemap file: sitemap-tier2-finance.xml is cohort 2; the pages file (home and hubs) counts as cohort 1. */
export function cohortOfSitemap(fileName: string): 1 | 2 | 3 {
  const m = /^sitemap-tier([123])/.exec(fileName);
  return m ? (Number(m[1]) as 1 | 2 | 3) : 1;
}

/** URLs to inspect this run: those never checked first, then the least recently checked, at most `limit`. */
export function pickStale(urls: readonly UrlToCheck[], existing: ReadonlyMap<string, IndexRow>, limit: number): UrlToCheck[] {
  const checked = (u: UrlToCheck): string => existing.get(u.url)?.checked_on ?? '';
  return [...urls].sort((a, b) => (checked(a) < checked(b) ? -1 : checked(a) > checked(b) ? 1 : a.url < b.url ? -1 : 1)).slice(0, limit);
}

/**
 * The new CSV rows: one per URL now in the sitemaps (a page that left the sitemaps leaves the file). A URL inspected
 * this run takes the fresh state and `checked_on = today`; any other keeps its previous row. `first_seen` is kept
 * from the first run that saw the URL, because the 90-day pruning clock starts there. Performance data is applied
 * to every row it covers, since one Search Analytics query returns all pages.
 */
export function mergeRows(
  urls: readonly UrlToCheck[],
  existing: ReadonlyMap<string, IndexRow>,
  inspected: ReadonlyMap<string, { coverageState: string; lastCrawlDate: string }>,
  performance: ReadonlyMap<string, { impressions: number; clicks: number }>,
  today: string,
): IndexRow[] {
  return urls.map(({ url, cohort }) => {
    const old = existing.get(url);
    const fresh = inspected.get(url);
    const perf = performance.get(url);
    return {
      url,
      cohort,
      coverage_state: fresh?.coverageState ?? old?.coverage_state ?? 'Not checked yet',
      last_crawl_date: fresh?.lastCrawlDate ?? old?.last_crawl_date ?? '',
      impressions_90d: perf ? perf.impressions : (old?.impressions_90d ?? 0),
      clicks_90d: perf ? perf.clicks : (old?.clicks_90d ?? 0),
      first_seen: old?.first_seen || today,
      checked_on: fresh ? today : (old?.checked_on ?? ''),
    };
  });
}
