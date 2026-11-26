// Fails if package-lock.json points at anything other than the public npm registry.
//
// Why: `npm install` on a machine whose npm is configured for a private registry writes that registry's URLs into
// the lockfile for any package it adds. CI cannot reach a private host, so `npm ci` fails and a CI run is wasted
// (it happened on PR #5). typecheck, tests and build cannot catch it, so `npm run verify` runs this first.
//
//   node scripts/check-lockfile.mjs [path-to-lockfile]
import { readFileSync } from 'node:fs';

const file = process.argv[2] ?? 'package-lock.json';
const lock = JSON.parse(readFileSync(file, 'utf8'));
const PUBLIC = 'https://registry.npmjs.org/';

const bad = Object.entries(lock.packages ?? {})
  .filter(([, pkg]) => typeof pkg.resolved === 'string' && !pkg.resolved.startsWith(PUBLIC))
  // file: and git+ resolutions are legitimate for local or git dependencies; only remote registries matter here
  .filter(([, pkg]) => /^https?:\/\//.test(pkg.resolved));

if (bad.length) {
  console.error(`${file}: ${bad.length} package(s) resolve outside ${PUBLIC}`);
  for (const [name, pkg] of bad.slice(0, 10)) console.error(`  ${name || '(root)'} -> ${pkg.resolved}`);
  console.error('Rewrite those URLs to the public registry (same path after the registry prefix) before pushing.');
  process.exit(1);
}
console.log(`${file}: all ${Object.keys(lock.packages ?? {}).length} entries resolve from ${PUBLIC} (or are local)`);
