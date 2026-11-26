import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import bmi from '../src/calculators/bmi-calculator';
import { hasAccessToken, isAdminPath, onRequest } from '../functions/_middleware';
import { validateForIndexing } from '../src/lib/quality-gate';
import { registry } from '../src/lib/registry';
import {
  KNOWN_HOSTS,
  REQUIRED_HEADERS,
  checkHeaders,
  checkPublicVars,
  externalHosts,
  findLeaks,
  inlinedFontProblems,
  parseCsp,
  parseHeaders,
} from '../scripts/check-security';

const headersFile = readFileSync('public/_headers', 'utf8');

describe('response headers (Prompt 15, step 1)', () => {
  const headers = parseHeaders(headersFile);

  it("public/_headers carries every required header with the plan's value", () => {
    expect(headers['Strict-Transport-Security']).toBe('max-age=63072000; includeSubDomains; preload');
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['Permissions-Policy']).toBe('camera=(), microphone=(), geolocation=(), interest-cohort=()');
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['Content-Security-Policy']).toBeTruthy();
    expect(checkHeaders(headersFile)).toEqual([]);
  });

  it('the CSP allows only hosts that have a stated reason, and no ad network until one is chosen', () => {
    const csp = parseCsp(headers['Content-Security-Policy']);
    const hosts = new Set(
      Object.values(csp)
        .flat()
        .filter((s) => /^https?:\/\//.test(s)),
    );
    expect([...hosts].sort()).toEqual(Object.keys(KNOWN_HOSTS).sort());
    expect(headers['Content-Security-Policy']).not.toMatch(/googlesyndication|doubleclick|google\.com/);
    expect(csp['script-src']).not.toContain("'unsafe-eval'");
    expect(csp['frame-ancestors']).toEqual(["'none'"]);
    expect(csp['object-src']).toEqual(["'none'"]);
    expect(csp['connect-src']).toContain('https://plausible.io');
  });

  it('fails a file that is missing a header, weakens one, or allows an unknown host', () => {
    const without = headersFile.replace(/^\s+X-Frame-Options:.*$/m, '');
    expect(checkHeaders(without).join()).toMatch(/no X-Frame-Options/);
    expect(checkHeaders(headersFile.replace('max-age=63072000', 'max-age=60')).join()).toMatch(/Strict-Transport-Security has an unexpected value/);
    expect(checkHeaders(headersFile.replace("script-src 'self'", "script-src 'self' 'unsafe-eval'")).join()).toMatch(/unsafe-eval/);
    expect(checkHeaders(headersFile.replace("; script-src 'self'", "; script-src 'self' https://evil.example")).join()).toMatch(/evil\.example/);
    expect(checkHeaders(headersFile.replace("script-src 'self'", 'script-src *')).join()).toMatch(/any host/);
    expect(Object.keys(REQUIRED_HEADERS)).toHaveLength(6);
  });

  it('allows fonts inlined as data: URLs, and the build fails if it would not', () => {
    const csp = parseCsp(parseHeaders(headersFile)['Content-Security-Policy'] ?? '');
    expect(csp['font-src']).toContain('data:');
    const css = '@font-face{src:url(data:font/woff2;base64,d09GMg==) format("woff2")}';
    expect(inlinedFontProblems(css, csp)).toEqual([]);
    expect(inlinedFontProblems(css, { ...csp, 'font-src': ["'self'"] }).join()).toMatch(/font-src does not allow data:/);
    expect(inlinedFontProblems('a{color:red}', { ...csp, 'font-src': ["'self'"] })).toEqual([]);
  });

  it('immutable caching is only on hashed build assets', () => {
    expect(headersFile).toMatch(/\/_astro\/\*\s+Cache-Control: public, max-age=31536000, immutable/);
  });

  it('finds scripts and stylesheets loaded from other hosts', () => {
    const html =
      '<script src="https://plausible.io/js/script.js" defer></script><link rel="stylesheet" href="https://fonts.example/x.css"><script src="/_astro/a.js"></script>';
    expect(externalHosts(html)).toEqual([
      { host: 'https://plausible.io', tag: 'script' },
      { host: 'https://fonts.example', tag: 'stylesheet' },
    ]);
  });
});

describe('/admin is closed without a Cloudflare Access token (Prompt 15, step 2)', () => {
  const next = vi.fn(async () => new Response('page'));
  const call = (path: string, headers: Record<string, string> = {}) =>
    onRequest({ request: new Request(`https://opuscalculator.com${path}`, { headers }), next });

  it('matches /admin and everything under it, and nothing that merely starts with the letters', () => {
    expect(isAdminPath('/admin')).toBe(true);
    expect(isAdminPath('/admin/')).toBe(true);
    expect(isAdminPath('/admin/indexation')).toBe(true);
    expect(isAdminPath('/administrator/')).toBe(false);
    expect(isAdminPath('/calculators/admin/')).toBe(false);
  });

  it('answers 401, uncached, with no token or an empty one', async () => {
    const noToken: Record<string, string>[] = [{}, { 'Cf-Access-Jwt-Assertion': '' }, { 'Cf-Access-Jwt-Assertion': '   ' }];
    for (const headers of noToken) {
      const res = await call('/admin/indexation', headers);
      expect(res.status).toBe(401);
      expect(res.headers.get('Cache-Control')).toBe('no-store');
    }
    expect(next).not.toHaveBeenCalled();
  });

  it('lets a request that carries a token through, and leaves every other page alone', async () => {
    expect(hasAccessToken(new Headers({ 'cf-access-jwt-assertion': 'abc.def.ghi' }))).toBe(true);
    const res = await call('/admin/indexation', { 'Cf-Access-Jwt-Assertion': 'abc.def.ghi' });
    expect(res.status).toBe(200);
    expect((await call('/calculators/bmi-calculator/')).status).toBe(200);
  });
});

describe('secret leak scan (Prompt 15, step 3)', () => {
  it('reports the NAME of a leaked variable, never its value', () => {
    const files = [{ path: '/_astro/a.js', text: 'var k="supersecretvalue123";' }];
    const out = findLeaks(files, { SEARCH_CONSOLE_CREDENTIALS: 'supersecretvalue123', PLAUSIBLE_DOMAIN: 'opuscalculator.com' });
    expect(out).toEqual(['/_astro/a.js contains the value of SEARCH_CONSOLE_CREDENTIALS']);
    expect(out.join()).not.toContain('supersecretvalue123');
  });

  it('ignores public values, short values and PUBLIC_ variables', () => {
    const files = [{ path: '/x.html', text: 'opuscalculator.com abc 12345678' }];
    expect(findLeaks(files, { PLAUSIBLE_DOMAIN: 'opuscalculator.com', MY_TOKEN: 'abc', PUBLIC_AD_TOKEN: '12345678' })).toEqual([]);
  });

  it('catches credential shapes even with no environment', () => {
    const shapes = [
      '-----BEGIN PRIVATE KEY-----',
      '"private_key": "x"',
      'AKIAABCDEFGHIJKLMNOP',
      'sk-ant-abcdefghijklmnop',
      `ghp_${'a'.repeat(36)}`,
      'xoxb-1234567890-abcdef',
    ];
    for (const text of shapes) expect(findLeaks([{ path: '/f.js', text }], {}).length, text).toBe(1);
  });

  it('flags a PUBLIC_ variable with a secret-looking name', () => {
    expect(checkPublicVars({ PUBLIC_API_KEY: 'x' }, '')).toHaveLength(1);
    expect(checkPublicVars({}, 'PUBLIC_SECRET_THING=')).toHaveLength(1);
    expect(checkPublicVars({ PUBLIC_AD_SCRIPT_URL: 'x' }, 'PUBLIC_AD_SCRIPT_URL=')).toEqual([]);
  });

  it('.env.example lists every variable the code reads and holds no values for secrets', () => {
    const example = readFileSync('.env.example', 'utf8');
    for (const name of [
      'COHORT_1_PUBLISHED',
      'COHORT_2_PUBLISHED',
      'COHORT_3_PUBLISHED',
      'PLAUSIBLE_DOMAIN',
      'SEARCH_CONSOLE_CREDENTIALS',
      'PROMOTION_GATE_SKIP',
      'PUBLIC_AD_SCRIPT_URL',
    ]) {
      expect(example, name).toMatch(new RegExp(`^${name}=`, 'm'));
    }
    expect(example).toMatch(/^SEARCH_CONSOLE_CREDENTIALS=$/m);
    expect(example).toContain('COHORT_2_PUBLISHED=false');
  });
});

describe('every input has a validator (Prompt 15, step 5)', () => {
  it('the gate rejects a calculator whose input has no zod validator', () => {
    expect(validateForIndexing(bmi, []).reasons.filter((r) => /validator/.test(r))).toEqual([]);
    const broken = { ...bmi, inputs: bmi.inputs.map((i, n) => (n === 0 ? { ...i, validator: undefined as never } : i)) };
    const result = validateForIndexing(broken, []);
    expect(result.pass).toBe(false);
    expect(result.reasons.join()).toContain(`input(s) without a zod validator: ${bmi.inputs[0].name}`);
  });

  it('every registered calculator, hand-written and generated, passes that rule', () => {
    const missing = registry.valid.flatMap((c) =>
      c.inputs.filter((i) => !i.validator || typeof i.validator.safeParse !== 'function').map((i) => `${c.slug}.${i.name}`),
    );
    expect(missing).toEqual([]);
    expect(registry.excluded.flatMap((e) => e.reasons).filter((reason) => /validator/.test(reason))).toEqual([]);
  });
});

describe('files that can hold a secret stay out of git (.gitignore, not only a developer machine)', () => {
  // `git check-ignore --no-index` reads the repository's own .gitignore and ignores the machine-wide one, so this
  // fails on a CI runner or a fresh clone exactly as it would for the next developer.
  const ignored = (path: string): boolean => spawnSync('git', ['check-ignore', '-q', '--no-index', path], { stdio: 'ignore' }).status === 0;

  it('ignores env files, keys, credentials, the local key file and local Claude settings', () => {
    const secretShaped = [
      '.env',
      '.env.local',
      '.env.production',
      '.dev.vars',
      'key.pem',
      'private.key',
      'cert.p12',
      'credentials.json',
      'search-console-credentials.json',
      'my-service-account-key.json',
      'secrets.json',
      'claude-toggle.bat',
      '.claude/settings.local.json',
    ];
    expect(secretShaped.filter((p) => !ignored(p))).toEqual([]);
  });

  it('still commits the example file (names only) and the project docs skill', () => {
    expect(ignored('.env.example')).toBe(false);
    expect(ignored('.claude/skills/docs-sync/SKILL.md')).toBe(false);
  });
});
