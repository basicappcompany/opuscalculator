import { generateKeyPairSync, createVerify } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkDist } from '../src/lib/audit';
import {
  DEMOTE_BELOW,
  EMPTY_GATE,
  checkPromotion,
  cohortOfSitemap,
  demotionCandidates,
  isCrawledNotIndexed,
  isIndexed,
  mergeRows,
  parseCsv,
  pickStale,
  promotionGate,
  pruneCandidates,
  slugOfUrl,
  summarize,
  toCsv,
  type GateFile,
  type IndexRow,
} from '../src/lib/indexation';
import { renderDashboard } from '../src/lib/indexation-dashboard';
import { SearchConsole, parseCredentials, signJwt, type Fetcher } from '../src/lib/search-console';
import { goneResponse, isGone, onRequest } from '../functions/_middleware';

const fixture = parseCsv(readFileSync('tests/fixtures/mock-indexation.csv', 'utf8'));
const row = (over: Partial<IndexRow>): IndexRow => ({
  url: 'https://opuscalculator.com/calculators/x/',
  cohort: 1,
  coverage_state: 'Submitted and indexed',
  last_crawl_date: '2026-11-01',
  impressions_90d: 0,
  clicks_90d: 0,
  first_seen: '2026-01-01',
  checked_on: '2026-11-20',
  ...over,
});

describe('CSV', () => {
  it('round-trips rows, including fields that need quoting', () => {
    const rows = [row({ coverage_state: 'Crawled, "currently" not indexed' }), row({ url: 'https://opuscalculator.com/a/', cohort: 3 })];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });

  it('reads the four columns in the plan even without the extra ones', () => {
    const parsed = parseCsv('url,cohort,coverage_state,last_crawl_date\nhttps://opuscalculator.com/,1,Submitted and indexed,2026-11-01\n');
    expect(parsed[0]).toMatchObject({ url: 'https://opuscalculator.com/', cohort: 1, impressions_90d: 0, clicks_90d: 0, first_seen: '' });
  });

  it('rejects a missing column and a bad cohort', () => {
    expect(() => parseCsv('url,cohort\nx,1\n')).toThrow(/missing the "coverage_state" column/);
    expect(() => parseCsv('url,cohort,coverage_state,last_crawl_date\nx,4,a,b\n')).toThrow(/cohort must be 1, 2 or 3/);
  });

  it('handles CRLF line endings', () => {
    expect(parseCsv('url,cohort,coverage_state,last_crawl_date\r\nx,2,a,b\r\n')).toHaveLength(1);
  });
});

describe('coverage states', () => {
  it('knows which states mean indexed', () => {
    expect(isIndexed('Submitted and indexed')).toBe(true);
    expect(isIndexed('Indexed, not submitted in sitemap')).toBe(true);
    expect(isIndexed('Crawled - currently not indexed')).toBe(false);
    expect(isIndexed('URL is unknown to Google')).toBe(false);
  });

  it('finds "Crawled, currently not indexed" with a hyphen or a dash', () => {
    expect(isCrawledNotIndexed('Crawled - currently not indexed')).toBe(true);
    expect(isCrawledNotIndexed('Crawled — currently not indexed')).toBe(true);
    expect(isCrawledNotIndexed('Discovered - currently not indexed')).toBe(false);
  });
});

describe('summary of the mock data (40 URLs)', () => {
  const s = summarize(fixture);

  it('totals and the rate by cohort', () => {
    expect(s.total).toBe(40);
    expect(s.indexed).toBe(13);
    expect(s.byCohort[1]).toMatchObject({ total: 10, indexed: 7, rate: 0.7, withClicks: 4, clickShare: 0.4 });
    expect(s.byCohort[2]).toMatchObject({ total: 20, indexed: 6, rate: 0.3, withClicks: 2, clickShare: 0.1 });
    expect(s.byCohort[3]).toMatchObject({ total: 10, indexed: 0, rate: 0 });
  });

  it('lists the crawled-not-indexed pages', () => {
    expect(s.crawledNotIndexed.length).toBe(fixture.filter((r) => /Crawled/.test(r.coverage_state)).length);
    expect(s.crawledNotIndexed.every((r) => isCrawledNotIndexed(r.coverage_state))).toBe(true);
  });
});

describe('promotion gate (Appendix B)', () => {
  const s = summarize(fixture);

  it('cohort 2 may publish when cohort 1 is above 40% indexed and at least 20% have clicks', () => {
    expect(promotionGate(s, 2)).toEqual({ cohort: 2, allowed: true, reasons: [] });
  });

  it('cohort 3 may not publish: cohort 2 is at 30% and 10%', () => {
    const d = promotionGate(s, 3);
    expect(d.allowed).toBe(false);
    expect(d.reasons).toHaveLength(2);
    expect(d.reasons.join(' ')).toMatch(/30\.0%.*above 40\.0%/);
    expect(d.reasons.join(' ')).toMatch(/10\.0%.*at least 20\.0%/);
  });

  const make = (indexed: number, clicks: number, total = 10) =>
    summarize(
      Array.from({ length: total }, (_, i) =>
        row({ cohort: 1, coverage_state: i < indexed ? 'Submitted and indexed' : 'Discovered - currently not indexed', clicks_90d: i < clicks ? 1 : 0 }),
      ),
    );

  it('exactly 40% indexed is not enough (the plan says above), exactly 20% with clicks is enough', () => {
    expect(promotionGate(make(4, 2), 2).allowed).toBe(false);
    expect(promotionGate(make(5, 2), 2).allowed).toBe(true);
    expect(promotionGate(make(5, 1), 2).allowed).toBe(false);
  });

  it('no data is not a pass', () => {
    expect(promotionGate(summarize([]), 2).allowed).toBe(false);
    expect(promotionGate(summarize([]), 2).reasons[0]).toMatch(/nothing to measure/);
  });

  it('demotion: cohorts below 30% indexation are flagged', () => {
    expect(DEMOTE_BELOW).toBe(0.3);
    expect(demotionCandidates(s)).toEqual([3]); // cohort 2 is exactly 30%, which is not below it
  });
});

describe('pruning', () => {
  const today = '2026-11-22';

  it('needs zero impressions AND zero clicks AND 90 days in the sitemaps', () => {
    expect(pruneCandidates([row({ first_seen: '2026-05-01' })], today)).toHaveLength(1);
    expect(pruneCandidates([row({ first_seen: '2026-05-01', impressions_90d: 1 })], today)).toHaveLength(0);
    expect(pruneCandidates([row({ first_seen: '2026-05-01', clicks_90d: 1 })], today)).toHaveLength(0);
    expect(pruneCandidates([row({ first_seen: '2026-09-01' })], today)).toHaveLength(0); // 82 days
    expect(pruneCandidates([row({ first_seen: '2026-08-24' })], today)).toHaveLength(1); // exactly 90 days
    expect(pruneCandidates([row({ first_seen: '' })], today)).toHaveLength(0);
  });

  it('on the mock data: 10 cohort 2 and 10 cohort 3 pages, all calculators', () => {
    const c = pruneCandidates(fixture, today);
    expect(c).toHaveLength(20);
    expect(c.every((r) => slugOfUrl(r.url) !== null)).toBe(true);
  });

  it('slugOfUrl returns null for the home page and hubs, which are never pruned', () => {
    expect(slugOfUrl('https://opuscalculator.com/')).toBeNull();
    expect(slugOfUrl('https://opuscalculator.com/categories/finance/')).toBeNull();
    expect(slugOfUrl('https://opuscalculator.com/calculators/bmi-calculator/')).toBe('bmi-calculator');
  });
});

describe('merging a run into the CSV', () => {
  const urls = [
    { url: 'https://opuscalculator.com/a/', cohort: 1 as const },
    { url: 'https://opuscalculator.com/b/', cohort: 2 as const },
  ];
  const existing = new Map([
    [
      'https://opuscalculator.com/a/',
      row({ url: 'https://opuscalculator.com/a/', first_seen: '2026-01-05', checked_on: '2026-11-01', coverage_state: 'Old state' }),
    ],
    ['https://opuscalculator.com/gone/', row({ url: 'https://opuscalculator.com/gone/' })],
  ]);

  it('keeps first_seen, applies fresh state and performance, adds new URLs and drops ones that left the sitemaps', () => {
    const merged = mergeRows(
      urls,
      existing,
      new Map([['https://opuscalculator.com/a/', { coverageState: 'Submitted and indexed', lastCrawlDate: '2026-11-21' }]]),
      new Map([['https://opuscalculator.com/a/', { impressions: 9, clicks: 2 }]]),
      '2026-11-22',
    );
    expect(merged.map((r) => r.url)).toEqual(['https://opuscalculator.com/a/', 'https://opuscalculator.com/b/']);
    expect(merged[0]).toMatchObject({
      coverage_state: 'Submitted and indexed',
      first_seen: '2026-01-05',
      checked_on: '2026-11-22',
      impressions_90d: 9,
      clicks_90d: 2,
    });
    expect(merged[1]).toMatchObject({ coverage_state: 'Not checked yet', first_seen: '2026-11-22', checked_on: '' });
  });

  it('a URL not inspected this run keeps its previous state and check date', () => {
    const merged = mergeRows(urls, existing, new Map(), new Map(), '2026-11-22');
    expect(merged[0]).toMatchObject({ coverage_state: 'Old state', checked_on: '2026-11-01' });
  });

  it('inspects never-checked URLs first, then the stalest, up to the limit', () => {
    const picked = pickStale(urls, existing, 1);
    expect(picked.map((u) => u.url)).toEqual(['https://opuscalculator.com/b/']);
  });

  it('maps sitemap files to cohorts', () => {
    expect(cohortOfSitemap('sitemap-tier1.xml')).toBe(1);
    expect(cohortOfSitemap('sitemap-tier2-finance.xml')).toBe(2);
    expect(cohortOfSitemap('sitemap-tier3-conversion-2.xml')).toBe(3);
    expect(cohortOfSitemap('sitemap-pages.xml')).toBe(1);
  });
});

describe('checkPromotion (what rollout.ts enforces)', () => {
  const now = Date.parse('2026-12-01T00:00:00Z');
  const ok: GateFile = { generatedAt: '2026-11-28T00:00:00Z', allowed: { 2: true, 3: false }, reasons: { 2: [], 3: ['cohort 2 is at 30%'] } };

  it('Cohort 1 alone never needs the gate', () => {
    expect(checkPromotion({ 1: true, 2: false, 3: false }, EMPTY_GATE, now)).toEqual([]);
  });

  it('refuses cohort 2 when the gate has never been evaluated', () => {
    expect(checkPromotion({ 1: true, 2: true, 3: false }, EMPTY_GATE, now)[0]).toMatch(/never been evaluated/);
  });

  it('allows cohort 2 with a fresh allowed gate, and refuses cohort 3 on the same file', () => {
    expect(checkPromotion({ 1: true, 2: true, 3: false }, ok, now)).toEqual([]);
    expect(checkPromotion({ 1: true, 2: true, 3: true }, ok, now).join()).toMatch(/COHORT_3_PUBLISHED is true but the gate says no: cohort 2 is at 30%/);
  });

  it('refuses a stale evaluation (older than 14 days)', () => {
    expect(checkPromotion({ 1: true, 2: true, 3: false }, { ...ok, generatedAt: '2026-11-01T00:00:00Z' }, now)[0]).toMatch(/evaluated 30 days ago/);
  });

  it('refuses cohort 3 without cohort 2', () => {
    expect(checkPromotion({ 1: true, 2: false, 3: true }, { ...ok, allowed: { 2: true, 3: true } }, now).join()).toMatch(
      /cohort 3 cannot publish before cohort 2/,
    );
  });
});

describe('rollout.ts really refuses (the build fails)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('throws when COHORT_2_PUBLISHED is true and the committed gate file has not allowed it', async () => {
    vi.stubEnv('VITEST', '');
    vi.stubEnv('COHORT_2_PUBLISHED', 'true');
    vi.resetModules();
    await expect(import('../src/config/rollout')).rejects.toThrow(/Promotion gate: .*never been evaluated/);
  });

  it('ignores the local-only skip on CI and Cloudflare Pages', async () => {
    vi.stubEnv('VITEST', '');
    vi.stubEnv('COHORT_2_PUBLISHED', 'true');
    vi.stubEnv('PROMOTION_GATE_SKIP', 'local-only');
    vi.stubEnv('CI', 'true');
    vi.resetModules();
    await expect(import('../src/config/rollout')).rejects.toThrow(/Promotion gate/);
    vi.stubEnv('CI', '');
    vi.stubEnv('CF_PAGES', '1');
    vi.resetModules();
    await expect(import('../src/config/rollout')).rejects.toThrow(/Promotion gate/);
  });

  it('the local-only skip works on a developer machine', async () => {
    vi.stubEnv('VITEST', '');
    vi.stubEnv('COHORT_2_PUBLISHED', 'true');
    vi.stubEnv('PROMOTION_GATE_SKIP', 'local-only');
    vi.stubEnv('CI', '');
    vi.stubEnv('CF_PAGES', '');
    vi.resetModules();
    const mod = await import('../src/config/rollout');
    expect(mod.rollout[2]).toBe(true);
  });
});

describe('Search Console client (no network)', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const creds = { client_email: 'bot@project.iam.gserviceaccount.com', private_key: privateKey };

  it('signs a verifiable RS256 JWT with the right claims', () => {
    const jwt = signJwt(creds, 1000);
    const [h, c, sig] = jwt.split('.');
    expect(JSON.parse(Buffer.from(h, 'base64url').toString())).toEqual({ alg: 'RS256', typ: 'JWT' });
    expect(JSON.parse(Buffer.from(c, 'base64url').toString())).toMatchObject({
      iss: creds.client_email,
      iat: 1000,
      exp: 4600,
      scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    });
    const v = createVerify('RSA-SHA256');
    v.update(`${h}.${c}`);
    expect(v.verify(publicKey, Buffer.from(sig, 'base64url'))).toBe(true);
  });

  it('reads credentials from JSON or base64 and refuses junk without echoing it', () => {
    expect(parseCredentials(JSON.stringify(creds)).client_email).toBe(creds.client_email);
    expect(parseCredentials(Buffer.from(JSON.stringify(creds)).toString('base64')).client_email).toBe(creds.client_email);
    expect(() => parseCredentials(undefined)).toThrow(/SEARCH_CONSOLE_CREDENTIALS is not set/);
    expect(() => parseCredentials('SECRET-NOT-JSON')).toThrow(/not valid JSON/);
    try {
      parseCredentials('SECRET-NOT-JSON');
    } catch (e) {
      expect(String(e)).not.toContain('SECRET-NOT-JSON');
    }
  });

  const calls: { url: string; body: string }[] = [];
  const reply = (data: unknown, ok = true, status = 200) => ({ ok, status, json: async () => data, text: async () => JSON.stringify(data) });
  const fetcher: Fetcher = async (url, init) => {
    calls.push({ url, body: init.body });
    if (url.includes('oauth2')) return reply({ access_token: 'tok' });
    if (url.includes('index:inspect'))
      return reply({ inspectionResult: { indexStatusResult: { coverageState: 'Submitted and indexed', lastCrawlTime: '2026-11-18T03:04:05Z' } } });
    if (url.includes('searchAnalytics')) return reply({ rows: [{ keys: ['https://opuscalculator.com/a/'], clicks: 3, impressions: 40 }] });
    return reply({ error: 'nope' }, false, 403);
  };

  it('inspects a URL and reads Search Analytics with one token', async () => {
    const client = new SearchConsole(creds, 'https://opuscalculator.com/', fetcher, () => 5000);
    expect(await client.inspect('https://opuscalculator.com/a/')).toEqual({ coverageState: 'Submitted and indexed', lastCrawlDate: '2026-11-18' });
    expect([...(await client.performance('2026-08-24', '2026-11-22'))]).toEqual([['https://opuscalculator.com/a/', { impressions: 40, clicks: 3 }]]);
    expect(calls.filter((c) => c.url.includes('oauth2'))).toHaveLength(1);
    expect(JSON.parse(calls.find((c) => c.url.includes('index:inspect'))!.body)).toEqual({
      inspectionUrl: 'https://opuscalculator.com/a/',
      siteUrl: 'https://opuscalculator.com/',
    });
  });

  it('turns an API error into a message that includes the status', async () => {
    const bad: Fetcher = async (url) => (url.includes('oauth2') ? reply({ access_token: 't' }) : reply({ error: 'quota' }, false, 429));
    await expect(new SearchConsole(creds, 'x', bad).inspect('u')).rejects.toThrow(/answered 429/);
  });
});

describe('dashboard', () => {
  const html = renderDashboard(fixture, '2026-11-22');

  it('shows totals, the rate by cohort, the gate, the crawled-not-indexed list and the pruning candidates', () => {
    expect(html).toContain('40 published, 13 indexed (32.5%)');
    expect(html).toContain('<th scope="row">Cohort 1</th><td>10</td><td>7</td><td>70.0%</td><td>4</td><td>40.0%</td>');
    expect(html).toContain('Promote cohort 2: allowed.');
    expect(html).toContain('Promote cohort 3: not allowed.');
    expect(html).toContain('Crawled, currently not indexed (');
    expect(html).toContain('Pruning candidates (20)');
    expect(html).toContain('Below 30% indexation: cohort 3');
  });

  it('is a single local document: noindex, no script, no external requests', () => {
    expect(html).toContain('<meta name="robots" content="noindex, nofollow">');
    expect(html).not.toMatch(/<script|src=|@import|https?:\/\/[^"' ]+\.(js|css)/);
  });

  it('escapes what it prints', () => {
    expect(renderDashboard([row({ url: 'https://opuscalculator.com/<b>/', coverage_state: 'Crawled - currently not indexed' })], '2026-11-22')).not.toContain(
      '<b>',
    );
  });
});

describe('pruned pages stay out of the sitemaps and out of the "not in a sitemap" check', () => {
  afterEach(() => {
    vi.doUnmock('../src/config/pruned.json');
    vi.resetModules();
  });

  it('a pruned slug is left out of the sitemap entries', async () => {
    vi.doMock('../src/config/pruned.json', () => ({ default: { slugs: ['bmi-calculator'] } }));
    vi.resetModules();
    const { collectEntries } = await import('../src/lib/sitemaps');
    const paths = collectEntries().map((e) => e.path);
    expect(paths).not.toContain('/calculators/bmi-calculator/');
    expect(paths).toContain('/calculators/mortgage-calculator/');
  }, 60000);

  it('checkDist accepts a noindex page that is in no sitemap, and still rejects an indexable one', () => {
    const page = (extra: string) => `<html><head>${extra}</head><body><a href="/">home</a></body></html>`;
    const base = { sitemaps: [{ name: 'sitemap-pages.xml', paths: ['/'] }], indexedNames: ['sitemap-pages.xml'], unpublishedPaths: new Set<string>() };
    const withNoindex = new Map([
      ['/', page('')],
      ['/x/', page('<meta name="robots" content="noindex, follow">')],
    ]);
    expect(checkDist({ ...base, pages: withNoindex })).toEqual([]);
    const without = new Map([
      ['/', page('')],
      ['/x/', page('')],
    ]);
    expect(checkDist({ ...base, pages: without }).join()).toMatch(/\/x\/ is in no sitemap/);
  });
});

describe('410 Gone (Cloudflare Pages Function)', () => {
  it('matches a gone path with or without a trailing slash, and nothing else', () => {
    expect(isGone('/calculators/old/', ['/calculators/old/'])).toBe(true);
    expect(isGone('/calculators/old', ['/calculators/old/'])).toBe(true);
    expect(isGone('/calculators/new/', ['/calculators/old/'])).toBe(false);
  });

  it('answers 410, not 404, and passes everything else on', async () => {
    expect(goneResponse().status).toBe(410);
    const next = vi.fn(async () => new Response('ok'));
    const res = await onRequest({ request: new Request('https://opuscalculator.com/anything/'), next });
    expect(next).toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it('nothing is gone yet, and no gone path is also a published page', () => {
    expect(JSON.parse(readFileSync('src/config/gone.json', 'utf8')).paths).toEqual([]);
  });
});
