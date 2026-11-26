// Prompt 7: crawls the built site (dist/) and reports orphans, thin inbound linking, sitemap-only pages and
// links to unpublished pages.   npm run build && npm run audit
// Exit code 1 if there is any orphan or any link to an unpublished or missing page. Pages with fewer than 3 inbound
// links are reported but do not fail the audit on their own.
import { auditLinks } from '../src/lib/audit';
import { readPages, readSitemaps, unpublishedPaths } from './dist-reader';

const MIN_INBOUND = 3;

export default function main(): number {
  const pages = readPages();
  const { files } = readSitemaps();
  const sitemapPaths = new Set(files.flatMap((f) => f.paths));
  const r = auditLinks({ pages, sitemapPaths, unpublishedPaths: unpublishedPaths() }, MIN_INBOUND);

  const show = (title: string, rows: string[], limit = 25) => {
    console.log(`${title}: ${rows.length}`);
    for (const row of rows.slice(0, limit)) console.log(`  ${row}`);
    if (rows.length > limit) console.log(`  ... and ${rows.length - limit} more`);
  };

  console.log(`Link audit of dist/: ${pages.size} pages, ${sitemapPaths.size} sitemap URLs`);
  const counts = [...r.inbound.values()].map((v) => v.length).sort((a, b) => a - b);
  const content = [...r.inbound]
    .filter(([p]) => p !== '/')
    .map(([, v]) => v.length)
    .sort((a, b) => a - b);
  if (content.length)
    console.log(
      `Inbound links per page (excluding home): min ${content[0]}, median ${content[Math.floor(content.length / 2)]}, max ${content[content.length - 1]}`,
    );
  void counts;
  console.log('');
  show('Orphan pages (no inbound internal link)', r.orphans);
  show(
    `Pages with fewer than ${MIN_INBOUND} inbound links`,
    r.lowInbound.map((x) => `${x.path} (${x.count})`),
  );
  show('Pages reachable only from a sitemap', r.sitemapOnly);
  show(
    'Links to an unpublished or unbuilt page',
    r.badLinks.map((b) => `${b.from} -> ${b.to} (${b.reason})`),
  );
  return r.orphans.length || r.badLinks.length ? 1 : 0;
}
