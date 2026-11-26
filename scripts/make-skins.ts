// `npm run skins`: writes public/skins.css and the skins catalogue inside docs/ux-directions.html from src/lib/skins-data.ts.
// Both outputs are committed, and tests/skins.test.ts fails if either is out of date.
import { readFileSync, writeFileSync } from 'node:fs';
import { skinsCss, skinsJson } from '../src/lib/skins';
import { withCatalog } from '../src/lib/skins-catalog';
import { SKINS } from '../src/lib/skins-data';

export default function main(): number {
  writeFileSync('public/skins.css', skinsCss(SKINS));
  writeFileSync('public/skins.json', skinsJson(SKINS));
  const docs = 'docs/ux-directions.html';
  const html = readFileSync(docs, 'utf8');
  const nl = html.includes('\r\n') ? '\r\n' : '\n';
  const next = withCatalog(html.replace(/\r\n/g, '\n'), SKINS);
  writeFileSync(docs, nl === '\r\n' ? next.replace(/\n/g, '\r\n') : next);
  console.log(`skins: ${SKINS.length} skins written to public/skins.css, public/skins.json and docs/ux-directions.html`);
  return 0;
}
