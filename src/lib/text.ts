import katex from 'katex';

const SENTENCE_END = /(?<!\b(?:e\.g|i\.e|vs|approx|etc))(?<=[.!?])\s+(?=[A-Z0-9$"'(])/;

/**
 * Split SEO copy into the opening (the first `count` sentences, which carry the answer) and the rest.
 * The opening sits above the calculator; the rest goes in the explanation section below it.
 */
export function splitIntro(intro: string, count = 2): { lede: string; rest: string } {
  const sentences = intro.trim().split(SENTENCE_END);
  return { lede: sentences.slice(0, count).join(' '), rest: sentences.slice(count).join(' ') };
}

/**
 * The one sentence that goes under the title (the answer, in a sentence), and everything else of the intro for the "About" section
 * below the tool. Keeps the first screen for the calculator, on a phone above all. Nothing is dropped: the rest is still on the page.
 */
export function leadIntro(intro: string): { lead: string; more: string } {
  const { lede, rest } = splitIntro(intro, 1);
  return { lead: lede, more: rest };
}

const escapeHtml = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** KaTeX to an HTML string at build time. A bad formula renders as its source text, never throws. */
export function renderLatex(latex: string, displayMode = false): string {
  return katex.renderToString(latex, { displayMode, throwOnError: false, output: 'htmlAndMathml' });
}

/** Plain text with inline maths in $...$. Everything outside the dollar signs is escaped. */
export function renderMathText(text: string): string {
  return text
    .split(/(\$[^$]+\$)/)
    .map((part) => (part.length > 2 && part.startsWith('$') && part.endsWith('$') ? renderLatex(part.slice(1, -1)) : escapeHtml(part)))
    .join('');
}
