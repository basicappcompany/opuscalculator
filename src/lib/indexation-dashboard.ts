import { demotionCandidates, promotionGate, pruneCandidates, summarize, type IndexRow } from './indexation';

const esc = (s: string | number): string => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
const pct = (x: number): string => `${(x * 100).toFixed(1)}%`;

/**
 * The indexation dashboard as one self-contained HTML document (Prompt 8, item 2): totals, indexation rate by
 * cohort, the promotion gate, the pruning candidates and the "Crawled, currently not indexed" list.
 *
 * It is generated locally into reports/ and never deployed: a static site cannot password-protect a page, and the page
 * lists internal URLs and traffic numbers (open question 12.10; Cloudflare Access in front of /admin/* is the
 * alternative if you want it online).
 */
export function renderDashboard(rows: readonly IndexRow[], today: string): string {
  const s = summarize(rows);
  const gates = [promotionGate(s, 2), promotionGate(s, 3)];
  const prune = pruneCandidates(rows, today);
  const demote = demotionCandidates(s);

  const cohortRows = ([1, 2, 3] as const)
    .map((c) => {
      const x = s.byCohort[c];
      return `<tr><th scope="row">Cohort ${c}</th><td>${x.total}</td><td>${x.indexed}</td><td>${pct(x.rate)}</td><td>${x.withClicks}</td><td>${pct(x.clickShare)}</td></tr>`;
    })
    .join('');
  const gateRows = gates
    .map(
      (g) =>
        `<li><strong>Promote cohort ${g.cohort}: ${g.allowed ? 'allowed' : 'not allowed'}.</strong>${g.reasons.length ? ` ${esc(g.reasons.join(' '))}` : ' Cohort ' + (g.cohort - 1) + ' is above 40% indexed and at least 20% of its pages have clicks.'}</li>`,
    )
    .join('');
  const list = (items: readonly IndexRow[], empty: string): string =>
    items.length
      ? `<ul>${items.map((r) => `<li><a href="${esc(r.url)}">${esc(r.url)}</a> <span>cohort ${r.cohort}, last crawl ${esc(r.last_crawl_date || 'never')}</span></li>`).join('')}</ul>`
      : `<p>${empty}</p>`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow">
<title>Indexation dashboard</title>
<style>
:root{--bg:#f8fafc;--fg:#0f172a;--muted:#475569;--line:#cbd5e1;--ok:#166534;--bad:#b91c1c}
@media (prefers-color-scheme:dark){:root{--bg:#0b1220;--fg:#e2e8f0;--muted:#94a3b8;--line:#334155;--ok:#4ade80;--bad:#f87171}}
body{font:16px/1.5 system-ui,sans-serif;background:var(--bg);color:var(--fg);margin:0 auto;max-width:56rem;padding:1rem}
table{border-collapse:collapse;width:100%}th,td{border:1px solid var(--line);padding:.4rem .6rem;text-align:right}th[scope=row],thead th:first-child{text-align:left}
li span{color:var(--muted);font-size:.85em}a{color:inherit}.big{font-size:1.6rem;font-weight:700}
</style></head><body>
<h1>Indexation dashboard</h1>
<p>Generated for ${esc(today)} from ${rows.length} URLs. Local file: do not deploy.</p>
<p class="big">${s.total} published, ${s.indexed} indexed (${pct(s.total ? s.indexed / s.total : 0)})</p>
<h2>By cohort</h2>
<table><thead><tr><th>Cohort</th><th>Published</th><th>Indexed</th><th>Indexation rate</th><th>With clicks</th><th>Click share</th></tr></thead><tbody>${cohortRows}</tbody></table>
<h2>Promotion gate</h2>
<ul>${gateRows}</ul>
${demote.length ? `<p style="color:var(--bad)">Below 30% indexation: cohort ${demote.join(', ')}. The demotion rule says to switch the worst clusters off and set them to noindex.</p>` : ''}
<h2>Crawled, currently not indexed (${s.crawledNotIndexed.length})</h2>
${list(s.crawledNotIndexed, 'None.')}
<h2>Pruning candidates (${prune.length})</h2>
<p>Zero impressions and zero clicks over 90 days, and in the sitemaps for at least 90 days. They would become noindex, not be deleted.</p>
${list(prune, 'None.')}
</body></html>
`;
}
