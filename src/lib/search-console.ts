import { createSign } from 'node:crypto';

/**
 * Minimal Google Search Console client for scripts/check-indexation.ts: a service-account JWT, the URL Inspection
 * API and the Search Analytics API, using only fetch and node:crypto. `fetcher` and `now` are injectable so the
 * tests run with no network. It is NEVER imported by a page or a component (credentials must stay out of the client
 * bundle, Appendix A).
 *
 * Quota note, from my reading of the docs and not measured here: the URL Inspection API allows a limited number of
 * calls per property per day (about 2,000), which is why the script takes a --limit and checks the stalest URLs first.
 */

export type Fetcher = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown>; text(): Promise<string> }>;

export interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const b64url = (input: Buffer | string): string => Buffer.from(input).toString('base64url');

export function parseCredentials(raw: string | undefined): ServiceAccount {
  if (!raw)
    throw new Error('SEARCH_CONSOLE_CREDENTIALS is not set. Put the service account JSON in that environment variable on your own machine; never commit it.');
  let json: Partial<ServiceAccount>;
  try {
    json = JSON.parse(raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8'));
  } catch {
    throw new Error('SEARCH_CONSOLE_CREDENTIALS is not valid JSON (or base64 of JSON)');
  }
  if (!json.client_email || !json.private_key) throw new Error('SEARCH_CONSOLE_CREDENTIALS must contain client_email and private_key');
  return json as ServiceAccount;
}

/** Signed JWT for the OAuth 2.0 service-account flow (RS256). */
export function signJwt(creds: ServiceAccount, nowSeconds: number): string {
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(
    JSON.stringify({
      iss: creds.client_email,
      scope: SCOPE,
      aud: creds.token_uri ?? 'https://oauth2.googleapis.com/token',
      iat: nowSeconds,
      exp: nowSeconds + 3600,
    }),
  );
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  return `${header}.${claims}.${signer.sign(creds.private_key).toString('base64url')}`;
}

export class SearchConsole {
  private token: string | null = null;
  constructor(
    private readonly creds: ServiceAccount,
    private readonly site: string,
    private readonly fetcher: Fetcher,
    private readonly now: () => number = () => Date.now(),
  ) {}

  private async post(url: string, body: unknown, auth: string, contentType = 'application/json'): Promise<unknown> {
    const res = await this.fetcher(url, {
      method: 'POST',
      headers: { 'Content-Type': contentType, ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${url} answered ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return res.json();
  }

  private async bearer(): Promise<string> {
    if (this.token) return this.token;
    const assertion = signJwt(this.creds, Math.floor(this.now() / 1000));
    const body = `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${encodeURIComponent(assertion)}`;
    const out = (await this.post(this.creds.token_uri ?? 'https://oauth2.googleapis.com/token', body, '', 'application/x-www-form-urlencoded')) as {
      access_token?: string;
    };
    if (!out.access_token) throw new Error('Google did not return an access token');
    this.token = out.access_token;
    return this.token;
  }

  /** URL Inspection API: coverage state and last crawl time of one URL. */
  async inspect(url: string): Promise<{ coverageState: string; lastCrawlDate: string }> {
    const out = (await this.post(
      'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect',
      { inspectionUrl: url, siteUrl: this.site },
      await this.bearer(),
    )) as {
      inspectionResult?: { indexStatusResult?: { coverageState?: string; lastCrawlTime?: string } };
    };
    const r = out.inspectionResult?.indexStatusResult;
    return { coverageState: r?.coverageState ?? 'Unknown', lastCrawlDate: (r?.lastCrawlTime ?? '').slice(0, 10) };
  }

  /** Search Analytics API: impressions and clicks per page between two ISO dates. Not part of URL Inspection. */
  async performance(startDate: string, endDate: string): Promise<Map<string, { impressions: number; clicks: number }>> {
    const out = (await this.post(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(this.site)}/searchAnalytics/query`,
      { startDate, endDate, dimensions: ['page'], rowLimit: 25000 },
      await this.bearer(),
    )) as {
      rows?: { keys: string[]; clicks: number; impressions: number }[];
    };
    return new Map((out.rows ?? []).map((r) => [r.keys[0], { impressions: r.impressions, clicks: r.clicks }]));
  }
}
