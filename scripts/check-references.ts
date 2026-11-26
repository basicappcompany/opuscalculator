// `npm run refs:check`: opens every reference URL in the registry and reports the ones that do not load (item 20.12).
// Not part of `npm run build` or CI on purpose: a third-party outage must never be able to fail a deploy. Run it when
// references are added and now and then after. Exit code 1 means at least one link is dead (404, 410, a server error, a
// timeout or a refused connection). A site that blocks automated requests (403, 405, 429) is listed as "could not verify"
// and does not fail the run: open it in a browser.
import { registry } from '../src/lib/registry';

const TIMEOUT_MS = 15_000;
// Identifies the check and points at the site's contact page; no personal details.
const HEADERS = { 'User-Agent': 'OpusCalculatorLinkCheck/1.0 (+https://opuscalculator.com/contact/)', Accept: 'text/html,application/pdf,*/*' };

async function open(url: string): Promise<{ status: number; note?: string }> {
  for (const method of ['HEAD', 'GET'] as const) {
    try {
      const res = await fetch(url, { method, headers: HEADERS, redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (method === 'HEAD' && (res.status === 405 || res.status === 403 || res.status === 400 || res.status === 501)) continue; // try GET
      return { status: res.status };
    } catch (error) {
      if (method === 'GET') return { status: 0, note: error instanceof Error ? error.message : 'request failed' };
    }
  }
  return { status: 0, note: 'request failed' };
}

export default async function main(): Promise<number> {
  const byUrl = new Map<string, string[]>();
  for (const c of registry.valid) for (const r of c.references ?? []) byUrl.set(r.url, [...(byUrl.get(r.url) ?? []), c.slug]);
  if (byUrl.size === 0) {
    console.log('refs:check: no references in the registry yet.');
    return 0;
  }
  const dead: string[] = [];
  const unverified: string[] = [];
  let ok = 0;
  for (const [url, slugs] of byUrl) {
    const { status, note } = await open(url);
    const where = `${url}  (${slugs.slice(0, 3).join(', ')}${slugs.length > 3 ? `, +${slugs.length - 3}` : ''})`;
    if (status >= 200 && status < 400) ok += 1;
    else if (status === 403 || status === 405 || status === 429) unverified.push(`${status} ${where}`);
    else dead.push(`${status || 'no response'}${note ? ` (${note})` : ''} ${where}`);
  }
  console.log(`refs:check: ${byUrl.size} distinct URLs, ${ok} load, ${unverified.length} could not be verified automatically, ${dead.length} dead.`);
  for (const line of unverified) console.log(`  could not verify: ${line}`);
  for (const line of dead) console.error(`  DEAD: ${line}`);
  return dead.length ? 1 : 0;
}
