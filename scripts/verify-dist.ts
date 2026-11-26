// Runs after `astro build` (see the "build" script). Fails the build, loudly, if any sitemap lists an unpublished,
// missing, noindex or duplicate URL, if any rendered page links to an unpublished or unbuilt page, or if a path listed
// in src/config/gone.json (410) is still a built page. On success it writes dist/_routes.json so the Pages Function runs
// only for /admin/* (401 without a Cloudflare Access token) and the gone paths (410).
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { aiDiscoveryProblems, structuredAnswerProblems } from '../src/lib/ai-discovery-checks';
import { checkDist } from '../src/lib/audit';
import { REQUIRED_FOOTER_PATHS } from '../src/lib/static-pages';
import { DIST, readPages, readSitemaps, unpublishedPaths } from './dist-reader';

export default function main(): number {
  const pages = readPages();
  const { files, indexedNames } = readSitemaps();
  const problems = checkDist({ pages, sitemaps: files, indexedNames, unpublishedPaths: unpublishedPaths(), requiredLinks: REQUIRED_FOOTER_PATHS });

  // AI-readable layer (items 20.6 and 20.8): /llms.txt, a markdown copy per calculator, structured answers that match the page.
  const llmsFile = join(DIST, 'llms.txt');
  const calcDir = join(DIST, 'calculators');
  const markdownSlugs = new Set((existsSync(calcDir) ? readdirSync(calcDir) : []).filter((n) => n.endsWith('.md')).map((n) => n.slice(0, -3)));
  problems.push(...aiDiscoveryProblems(pages, { llms: existsSync(llmsFile) ? readFileSync(llmsFile, 'utf8') : undefined, markdownSlugs }));
  problems.push(...structuredAnswerProblems(pages));

  const gone: string[] = (JSON.parse(readFileSync('src/config/gone.json', 'utf8')) as { paths: string[] }).paths;
  for (const path of gone) if (pages.has(path)) problems.push(`${path} is listed as gone (410) but is still a built page`);

  const urls = files.reduce((n, f) => n + f.paths.length, 0);
  if (problems.length) {
    console.error(`\nverify-dist FAILED with ${problems.length} problem(s):`);
    for (const p of problems.slice(0, 50)) console.error(`  - ${p}`);
    if (problems.length > 50) console.error(`  ... and ${problems.length - 50} more`);
    return 1;
  }
  writeFileSync(join(DIST, '_routes.json'), JSON.stringify({ version: 1, include: ['/admin/*', ...gone], exclude: [] }, null, 2) + '\n');
  console.log(
    `verify-dist OK: ${pages.size} pages, ${files.length} sitemap file(s) with ${urls} URLs, no unpublished or duplicate URLs, no links to unpublished pages, ${gone.length} gone path(s).`,
  );
  return 0;
}
