/**
 * The calculator toolbar (plan/PROMPT 19): share, cite, share a result, embed, and the Google preferred-source link.
 * Pure functions, so the page component, the widget and the build checks use the same text and the same rules.
 * Nothing here stores anything (CLAUDE.md rule 4).
 */
import { SITE_NAME, SITE_URL } from './seo';

/** Every calculator page carries all of these; verify-dist fails the build for a page that lacks one (item 20.10). */
import { TOOLBAR_HOOKS } from './audit';
export { TOOLBAR_HOOKS };

export const SITE_HOST = new URL(SITE_URL).host;

/** The frameable copy of a calculator: the calculator alone, noindex, canonical to the real page. */
export const embedPath = (slug: string): string => `/embed/${slug}/`;

/** Google's documented link that lets a signed-in reader add a site as a preferred source (Search Central, preferred sources). */
export const preferredSourceUrl = (host: string = SITE_HOST): string => `https://www.google.com/preferences/source?q=${encodeURIComponent(host)}`;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "2026-11-23" becomes { year: "2026", long: "November 23" }; anything else is passed through without a date. */
function splitDate(iso: string): { year: string; long: string } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const month = MONTHS[Number(m[2]) - 1];
  return month ? { year: m[1], long: `${month} ${Number(m[3])}` } : null;
}

/** Ready-to-paste citation text: APA style, and a plain one-line form. */
export function citationLines(title: string, url: string, lastUpdated: string): { apa: string; plain: string } {
  const d = splitDate(lastUpdated);
  const apa = d ? `${SITE_NAME}. (${d.year}, ${d.long}). ${title} [Online calculator]. ${url}` : `${SITE_NAME}. (n.d.). ${title} [Online calculator]. ${url}`;
  return { apa, plain: `${title}, ${SITE_NAME}, ${url}` };
}

const escapeAttr = (s: string): string => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The iframe a site owner pastes to show the calculator. `width` is "100%" (responsive) or a number of pixels. */
export function embedSnippet(embedUrl: string, title: string, height = 640, width: number | '100%' = '100%'): string {
  const w = width === '100%' ? '100%' : String(Math.round(width));
  return `<iframe src="${escapeAttr(embedUrl)}" title="${escapeAttr(title)}" width="${w}" height="${Math.round(height)}" loading="lazy" style="border:0;max-width:100%"></iframe>`;
}

const MLA_MONTHS = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];

export interface CitationFormat {
  id: 'apa' | 'mla' | 'chicago' | 'bibtex' | 'plain';
  label: string;
  text: string;
}

/** The same citation in the styles people ask for. Only the date the page was last updated is used, never "today". */
export function citationFormats(title: string, url: string, lastUpdated: string, slug = ''): CitationFormat[] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(lastUpdated);
  const month = m ? MONTHS[Number(m[2]) - 1] : undefined;
  const mlaMonth = m ? MLA_MONTHS[Number(m[2]) - 1] : undefined;
  const day = m ? String(Number(m[3])) : '';
  const year = m?.[1];
  const known = Boolean(m && month && mlaMonth);
  const key = `opus_${(slug || new URL(url).pathname.split('/').filter(Boolean).pop() || 'calculator').replace(/[^a-z0-9]+/gi, '_').toLowerCase()}`;
  return [
    { id: 'apa', label: 'APA', text: citationLines(title, url, lastUpdated).apa },
    { id: 'mla', label: 'MLA', text: `"${title}." ${SITE_NAME}, ${known ? `${day} ${mlaMonth} ${year}, ` : ''}${url}.` },
    { id: 'chicago', label: 'Chicago', text: `${SITE_NAME}. "${title}." ${known ? `Last modified ${month} ${day}, ${year}. ` : ''}${url}.` },
    {
      id: 'bibtex',
      label: 'BibTeX',
      text: [
        '@misc{' + key + ',',
        `  title = {${title}},`,
        `  author = {{${SITE_NAME}}},`,
        ...(year ? [`  year = {${year}},`] : []),
        `  url = {${url}},`,
        `  note = {Online calculator${known ? `, last updated ${lastUpdated}` : ''}}`,
        '}',
      ].join('\n'),
    },
    { id: 'plain', label: 'Plain text', text: citationLines(title, url, lastUpdated).plain },
  ];
}

export interface ShareLink {
  id: string;
  label: string;
  href: string;
}

/** Plain links to the usual places a page is shared. Nothing is loaded from them until the visitor clicks one. */
export function shareLinks(url: string, title: string, text = ''): ShareLink[] {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  const body = encodeURIComponent(text ? `${text}\n\n${url}` : url);
  return [
    { id: 'email', label: 'Email', href: `mailto:?subject=${t}&body=${body}` },
    { id: 'whatsapp', label: 'WhatsApp', href: `https://wa.me/?text=${encodeURIComponent(`${text || title} ${url}`)}` },
    { id: 'x', label: 'X', href: `https://twitter.com/intent/tweet?url=${u}&text=${encodeURIComponent(text || title)}` },
    { id: 'linkedin', label: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
    { id: 'facebook', label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { id: 'reddit', label: 'Reddit', href: `https://www.reddit.com/submit?url=${u}&title=${t}` },
    { id: 'telegram', label: 'Telegram', href: `https://t.me/share/url?url=${u}&text=${encodeURIComponent(text || title)}` },
  ];
}

/** Longest value a shared-result link may carry for one input. Calculator inputs are short; anything longer is not ours. */
export const MAX_SHARE_VALUE_LENGTH = 40;

/**
 * The link that reopens a calculator with the visitor's inputs. Only values that differ from the defaults are written,
 * so an untouched calculator shares the clean page URL. The query never changes the page's canonical (CLAUDE.md rule 7).
 */
export function shareResultUrl(pageUrl: string, values: Record<string, string>, defaults: Record<string, string>, keys: readonly string[]): string {
  const url = new URL(pageUrl);
  url.search = '';
  url.hash = '';
  for (const key of keys) {
    const value = values[key];
    if (value === undefined || value === (defaults[key] ?? '') || value.length > MAX_SHARE_VALUE_LENGTH) continue;
    url.searchParams.set(key, value);
  }
  return url.href;
}

const hasControlCharacter = (s: string): boolean => [...s].some((c) => c.charCodeAt(0) < 32);

/** The input values a shared link carries. Unknown names, over-long values and control characters are ignored. */
export function readShareParams(search: string, keys: readonly string[]): Record<string, string> {
  const params = new URLSearchParams(search);
  const out: Record<string, string> = {};
  for (const key of keys) {
    const value = params.get(key);
    if (value !== null && value.length <= MAX_SHARE_VALUE_LENGTH && !hasControlCharacter(value)) out[key] = value;
  }
  return out;
}
