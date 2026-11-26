import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TOOLBAR_HOOKS, checkDist, isEmbedPath, toolbarProblems } from '../src/lib/audit';
import {
  MAX_SHARE_VALUE_LENGTH,
  citationFormats,
  citationLines,
  embedPath,
  embedSnippet,
  preferredSourceUrl,
  readShareParams,
  shareLinks,
  shareResultUrl,
} from '../src/lib/toolbar';
import { checkEmbedHeaders, checkHeaders, parseBlocks } from '../scripts/check-security';

const headersFile = readFileSync('public/_headers', 'utf8');

describe('toolbar text (plan/PROMPT 19)', () => {
  it('cites in APA and plain form, with the canonical URL and the date the page was last updated', () => {
    const { apa, plain } = citationLines('BMI calculator', 'https://opuscalculator.com/calculators/bmi-calculator/', '2026-11-23');
    expect(apa).toBe('Opus Calculator. (2026, November 23). BMI calculator [Online calculator]. https://opuscalculator.com/calculators/bmi-calculator/');
    expect(plain).toBe('BMI calculator, Opus Calculator, https://opuscalculator.com/calculators/bmi-calculator/');
    expect(citationLines('X', 'https://opuscalculator.com/x/', 'soon').apa).toContain('(n.d.)');
  });

  it('builds an iframe that cannot be broken out of by the title', () => {
    const html = embedSnippet('https://opuscalculator.com/embed/bmi-calculator/', 'A "quoted" <title>');
    expect(html).toContain('src="https://opuscalculator.com/embed/bmi-calculator/"');
    expect(html).toContain('title="A &quot;quoted&quot; &lt;title&gt;"');
    expect(html.match(/<iframe/g)).toHaveLength(1);
    expect(embedPath('bmi-calculator')).toBe('/embed/bmi-calculator/');
  });

  it("links to Google's documented preferred-source page for this site and no other host", () => {
    expect(preferredSourceUrl()).toBe('https://www.google.com/preferences/source?q=opuscalculator.com');
  });
});

describe('share a result (item 20.2)', () => {
  const keys = ['homePrice', 'downPayment', 'termYears'];
  const defaults = { homePrice: '400000', downPayment: '80000', termYears: '30' };

  it('writes only what differs from the defaults, so an untouched calculator shares the clean URL', () => {
    const page = 'https://opuscalculator.com/calculators/mortgage-calculator/';
    expect(shareResultUrl(page, defaults, defaults, keys)).toBe(page);
    expect(shareResultUrl(`${page}?old=1#top`, { ...defaults, homePrice: '300000' }, defaults, keys)).toBe(`${page}?homePrice=300000`);
  });

  it('reads back the same values, and ignores unknown names, long values and control characters', () => {
    const url = new URL(shareResultUrl('https://opuscalculator.com/x/', { ...defaults, homePrice: '300000', termYears: '15' }, defaults, keys));
    expect(readShareParams(url.search, keys)).toEqual({ homePrice: '300000', termYears: '15' });
    expect(readShareParams('?evil=1&homePrice=300000', keys)).toEqual({ homePrice: '300000' });
    expect(readShareParams(`?homePrice=${'9'.repeat(MAX_SHARE_VALUE_LENGTH + 1)}`, keys)).toEqual({});
    expect(readShareParams('?homePrice=1%0A2', keys)).toEqual({});
  });
});

describe('the build fails when a calculator page lacks the toolbar (item 20.10)', () => {
  const calc = (hooks: readonly string[]) => hooks.map((h) => `<button data-toolbar="${h}">x</button>`).join('');
  const embed = (slug: string) =>
    `<html><head><link rel="canonical" href="https://opuscalculator.com/calculators/${slug}/" /><meta name="robots" content="noindex, follow" /></head></html>`;
  const site = (extra: [string, string][]) => new Map<string, string>([['/', '<html></html>'], ...extra]);

  it('passes a page with every control and its embed page', () => {
    expect(
      toolbarProblems(
        site([
          ['/calculators/a/', calc(TOOLBAR_HOOKS)],
          ['/embed/a/', embed('a')],
        ]),
      ),
    ).toEqual([]);
  });

  it('names the missing control, and a missing embed page', () => {
    const without = TOOLBAR_HOOKS.filter((h) => h !== 'cite');
    const problems = toolbarProblems(site([['/calculators/a/', calc(without)]])).join('\n');
    expect(problems).toMatch(/\/calculators\/a\/ has no "cite" toolbar control/);
    expect(problems).toMatch(/no embed page \/embed\/a\//);
  });

  it('fails an embed page that is indexable, points at the wrong canonical, or has no real page', () => {
    const indexable = '<html><head><link rel="canonical" href="https://opuscalculator.com/calculators/a/" /></head></html>';
    expect(
      toolbarProblems(
        site([
          ['/calculators/a/', calc(TOOLBAR_HOOKS)],
          ['/embed/a/', indexable],
        ]),
      ).join(),
    ).toMatch(/not noindex/);
    expect(
      toolbarProblems(
        site([
          ['/calculators/a/', calc(TOOLBAR_HOOKS)],
          ['/embed/a/', embed('b')],
        ]),
      ).join(),
    ).toMatch(/canonical/);
    expect(toolbarProblems(site([['/embed/z/', embed('z')]])).join()).toMatch(/which is not built/);
  });

  it('does not ask an embed page for the footer links, and is not an orphan', () => {
    expect(isEmbedPath('/embed/a/')).toBe(true);
    const pages = site([
      ['/calculators/a/', calc(TOOLBAR_HOOKS) + '<a href="/about/">a</a>'],
      ['/embed/a/', embed('a')],
      ['/about/', '<html></html>'],
    ]);
    const problems = checkDist({ pages, sitemaps: [], indexedNames: [], unpublishedPaths: new Set(), requiredLinks: ['/about/'] });
    expect(problems.filter((p) => p.includes('/embed/'))).toEqual([]);
  });
});

describe('only /embed/* may be framed (plan/PROMPT 19)', () => {
  it('public/_headers detaches the site headers for /embed/* and keeps everything else the same', () => {
    const blocks = parseBlocks(headersFile);
    expect(blocks['/embed/*'].detached).toEqual(['X-Frame-Options', 'Content-Security-Policy']);
    expect(blocks['/embed/*'].headers['Content-Security-Policy']).toContain('frame-ancestors *');
    expect(blocks['/*'].headers['X-Frame-Options']).toBe('DENY');
    expect(blocks['/*'].headers['Content-Security-Policy']).toContain("frame-ancestors 'none'");
    expect(checkEmbedHeaders(headersFile)).toEqual([]);
    expect(checkHeaders(headersFile)).toEqual([]);
  });

  it('fails a file with no embed block, a drifted embed CSP, or any other path made frameable', () => {
    const noEmbed = headersFile.replace(/\/embed\/\*[\s\S]*?(?=\n# Hashed)/, '');
    expect(checkEmbedHeaders(noEmbed).join()).toMatch(/no \/embed\/\* block/);
    expect(
      checkEmbedHeaders(
        headersFile.replace(
          "script-src 'self' 'unsafe-inline' https://plausible.io; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://plausible.io; object-src 'none'; frame-ancestors *",
          "script-src 'self' https://evil.example; frame-ancestors *",
        ),
      ).join(),
    ).toMatch(/differs from the site CSP/);
    expect(checkEmbedHeaders(headersFile.replace('frame-ancestors *', "frame-ancestors 'none'")).join()).toMatch(/frame-ancestors is not \*/);
    expect(checkEmbedHeaders(`${headersFile}\n/calculators/*\n  ! X-Frame-Options\n`).join()).toMatch(/only \/embed\/\* may be framed/);
  });
});

describe('citation styles and share links for the dialogs', () => {
  const url = 'https://opuscalculator.com/calculators/bmi-calculator/';
  const formats = citationFormats('BMI Calculator', url, '2026-11-23', 'bmi-calculator');
  const text = (id: string) => formats.find((f) => f.id === id)!.text;

  it('gives APA, MLA, Chicago, BibTeX and plain text, dated by the last update and never by today', () => {
    expect(formats.map((f) => f.id)).toEqual(['apa', 'mla', 'chicago', 'bibtex', 'plain']);
    expect(text('apa')).toBe(`Opus Calculator. (2026, November 23). BMI Calculator [Online calculator]. ${url}`);
    expect(text('mla')).toBe(`"BMI Calculator." Opus Calculator, 23 Nov. 2026, ${url}.`);
    expect(text('chicago')).toBe(`Opus Calculator. "BMI Calculator." Last modified November 23, 2026. ${url}.`);
    expect(text('plain')).toBe(`BMI Calculator, Opus Calculator, ${url}`);
  });

  it('writes valid BibTeX with a stable key, and copes with a missing date', () => {
    const bib = text('bibtex').split('\n');
    expect(bib[0]).toBe('@misc{opus_bmi_calculator,');
    expect(bib).toContain('  title = {BMI Calculator},');
    expect(bib).toContain('  author = {{Opus Calculator}},');
    expect(bib).toContain('  year = {2026},');
    expect(bib.at(-1)).toBe('}');
    const undated = citationFormats('X Calculator', 'https://opuscalculator.com/calculators/x/', 'soon');
    expect(undated.find((f) => f.id === 'mla')!.text).toBe('"X Calculator." Opus Calculator, https://opuscalculator.com/calculators/x/.');
    expect(undated.find((f) => f.id === 'bibtex')!.text).not.toContain('year');
  });

  it('builds plain share links that carry the address and the title, encoded', () => {
    const links = shareLinks(url, 'BMI & Health', 'Your BMI: 22.9');
    expect(links.map((l) => l.id)).toEqual(['email', 'whatsapp', 'x', 'linkedin', 'facebook', 'reddit', 'telegram']);
    const href = (id: string) => links.find((l) => l.id === id)!.href;
    expect(href('email')).toBe(`mailto:?subject=BMI%20%26%20Health&body=${encodeURIComponent(`Your BMI: 22.9\n\n${url}`)}`);
    expect(href('linkedin')).toBe(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`);
    expect(href('x')).toContain(`url=${encodeURIComponent(url)}`);
    for (const l of links.filter((x) => x.id !== 'email')) expect(l.href.startsWith('https://'), l.id).toBe(true);
  });

  it('sizes the embed snippet: responsive by default, a pixel width or height on request', () => {
    const src = 'https://opuscalculator.com/embed/bmi-calculator/';
    expect(embedSnippet(src, 'T')).toContain('width="100%" height="640"');
    expect(embedSnippet(src, 'T', 760, 480)).toContain('width="480" height="760"');
  });
});
