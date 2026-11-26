// Runs after the build (see the "build" script). Fails the build if the security promises of Prompt 15 are broken:
//   1. dist/_headers carries every required response header with the required value, and a CSP that has no 'unsafe-eval',
//      no wildcard script source and only hosts we have a reason for;
//   2. every third-party script or stylesheet the built pages load is allowed by that CSP (and nothing is allowed that no
//      page can use, apart from hosts tied to an optional feature);
//   3. no secret value from the build environment, and no private-key or token shape, appears anywhere in dist/;
//   4. no PUBLIC_ environment variable (copied into the browser bundle) has a secret-looking name.
// It reads files only. A value is never printed, only the name of the variable that leaked.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = join(process.cwd(), 'dist');

export const REQUIRED_HEADERS: Record<string, RegExp> = {
  'Strict-Transport-Security': /^max-age=63072000; includeSubDomains; preload$/,
  'X-Content-Type-Options': /^nosniff$/,
  'Referrer-Policy': /^strict-origin-when-cross-origin$/,
  'Permissions-Policy': /camera=\(\)/,
  'X-Frame-Options': /^DENY$/,
  'Content-Security-Policy': /default-src 'self'/,
};

/** Hosts the CSP may name, and the optional feature each one belongs to. A host not listed here fails the build. */
export const KNOWN_HOSTS: Record<string, string> = {
  'https://plausible.io': 'PLAUSIBLE_DOMAIN (cookieless analytics)',
};

/** Headers of the `/*` block of a Cloudflare Pages _headers file. */
export function parseHeaders(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  let inAll = false;
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    if (!/^\s/.test(raw)) {
      inAll = raw.trim() === '/*';
      continue;
    }
    if (!inAll) continue;
    const i = raw.indexOf(':');
    if (i > 0) out[raw.slice(0, i).trim()] = raw.slice(i + 1).trim();
  }
  return out;
}

/** Directive name to its sources, from a Content-Security-Policy value. */
export function parseCsp(csp: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const part of csp.split(';')) {
    const [name, ...sources] = part.trim().split(/\s+/);
    if (name) out[name] = sources;
  }
  return out;
}

export function checkHeaders(text: string): string[] {
  const problems: string[] = [];
  const headers = parseHeaders(text);
  for (const [name, pattern] of Object.entries(REQUIRED_HEADERS)) {
    if (!(name in headers)) problems.push(`_headers has no ${name}`);
    else if (!pattern.test(headers[name])) problems.push(`${name} has an unexpected value`);
  }
  const csp = parseCsp(headers['Content-Security-Policy'] ?? '');
  for (const directive of ['default-src', 'script-src', 'frame-ancestors', 'base-uri', 'form-action', 'object-src']) {
    if (!csp[directive]) problems.push(`the CSP has no ${directive}`);
  }
  if (csp['frame-ancestors'] && !csp['frame-ancestors'].includes("'none'")) problems.push("the CSP frame-ancestors is not 'none'");
  for (const [directive, sources] of Object.entries(csp)) {
    if (sources.includes("'unsafe-eval'")) problems.push(`the CSP ${directive} allows 'unsafe-eval'`);
    if (/script-src|default-src/.test(directive) && sources.includes('*')) problems.push(`the CSP ${directive} allows any host`);
    for (const s of sources)
      if (/^https?:\/\//.test(s) && !(s in KNOWN_HOSTS))
        problems.push(`the CSP ${directive} names ${s}, which has no entry in KNOWN_HOSTS (scripts/check-security.ts): add the reason or remove the host`);
  }
  return problems;
}

/**
 * The build inlines small font files into the CSS as data: URLs (KaTeX's fonts, for one). A CSP with font-src 'self'
 * blocks them: the browser logs an error and the page falls back to another font. Found by Lighthouse on the live
 * site on 27 Nov (best practices 93 on the percentage calculator).
 */
export function inlinedFontProblems(css: string, csp: Record<string, string[]>): string[] {
  if (!/url\(\s*["']?data:font\//i.test(css)) return [];
  const sources = csp['font-src'] ?? csp['default-src'] ?? [];
  return sources.includes('data:') ? [] : ['built CSS inlines fonts as data: URLs, but the CSP font-src does not allow data:'];
}

/** Hosts that built pages load scripts or stylesheets from. */
export function externalHosts(html: string): { host: string; tag: string }[] {
  const out: { host: string; tag: string }[] = [];
  for (const m of html.matchAll(/<script\b[^>]*\bsrc="(https?:\/\/[^"]+)"/gi)) out.push({ host: new URL(m[1]).origin, tag: 'script' });
  for (const m of html.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="(https?:\/\/[^"]+)"/gi))
    out.push({ host: new URL(m[1]).origin, tag: 'stylesheet' });
  return out;
}

export const SECRET_NAME = /SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE|CREDENTIAL|API[_-]?KEY|AUTH/i;
export const SECRET_SHAPES: [RegExp, string][] = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'a private key block'],
  [/"private_key"\s*:/, 'a service-account private_key field'],
  [/"client_email"\s*:\s*"[^"]+gserviceaccount\.com"/, 'a Google service-account email'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'an AWS access key id'],
  [/\bsk-ant-[A-Za-z0-9_-]{10,}/, 'an Anthropic API key'],
  [/\bghp_[A-Za-z0-9]{30,}/, 'a GitHub token'],
  [/\bxox[abprs]-[A-Za-z0-9-]{10,}/, 'a Slack token'],
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const TEXT = /\.(html|js|css|json|xml|txt|svg|map|webmanifest|_headers)$|_headers$/i;

/** Names of build-environment secrets whose value appears in `files`, plus shapes that look like credentials. */
export function findLeaks(files: { path: string; text: string }[], env: Record<string, string | undefined>): string[] {
  const problems: string[] = [];
  const secrets = Object.entries(env).filter(([name, value]) => SECRET_NAME.test(name) && !name.startsWith('PUBLIC_') && (value ?? '').length >= 8);
  for (const { path, text } of files) {
    for (const [name, value] of secrets) if (text.includes(value!)) problems.push(`${path} contains the value of ${name}`);
    for (const [shape, what] of SECRET_SHAPES) if (shape.test(text)) problems.push(`${path} contains ${what}`);
  }
  return problems;
}

export function checkPublicVars(env: Record<string, string | undefined>, example: string): string[] {
  const names = new Set([...Object.keys(env), ...[...example.matchAll(/^\s*(PUBLIC_[A-Z0-9_]+)\s*=/gm)].map((m) => m[1])]);
  return [...names]
    .filter((n) => n.startsWith('PUBLIC_') && SECRET_NAME.test(n))
    .map((n) => `${n} is copied into the browser bundle but its name says it is a secret`);
}

export default function main(): number {
  const problems: string[] = [];
  const headersFile = join(DIST, '_headers');
  if (!existsSync(headersFile)) problems.push('dist/_headers is missing (it comes from public/_headers)');
  else problems.push(...checkHeaders(readFileSync(headersFile, 'utf8')));

  // 2. third-party loads must be allowed by the CSP
  const csp = parseCsp(parseHeaders(existsSync(headersFile) ? readFileSync(headersFile, 'utf8') : '')['Content-Security-Policy'] ?? '');
  const files = walk(DIST);
  for (const file of files.filter((f) => f.endsWith('.html'))) {
    const html = readFileSync(file, 'utf8');
    for (const { host, tag } of externalHosts(html)) {
      const allowed = (tag === 'script' ? csp['script-src'] : csp['style-src']) ?? [];
      if (!allowed.includes(host)) problems.push(`${file.replace(DIST, '')} loads a ${tag} from ${host}, which the CSP does not allow`);
    }
  }

  // 2b. fonts inlined as data: URLs need font-src data:
  const css = files
    .filter((f) => f.endsWith('.css'))
    .map((f) => readFileSync(f, 'utf8'))
    .join(' ');
  problems.push(...inlinedFontProblems(css, csp));

  // 3. leaks
  const text = files.filter((f) => TEXT.test(f)).map((path) => ({ path: path.replace(DIST, ''), text: readFileSync(path, 'utf8') }));
  problems.push(...findLeaks(text, process.env));

  // 4. PUBLIC_ variables
  problems.push(...checkPublicVars(process.env, existsSync('.env.example') ? readFileSync('.env.example', 'utf8') : ''));

  if (problems.length) {
    console.error(`\ncheck-security FAILED with ${problems.length} problem(s):`);
    for (const p of problems.slice(0, 40)) console.error(`  - ${p}`);
    return 1;
  }
  const hosts = Object.keys(KNOWN_HOSTS).join(', ');
  console.log(
    `check-security OK: all ${Object.keys(REQUIRED_HEADERS).length} required headers present, CSP hosts limited to ${hosts}, no secret values or credential shapes in ${text.length} files of dist/.`,
  );
  return 0;
}
