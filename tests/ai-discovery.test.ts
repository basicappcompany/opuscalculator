import { describe, expect, it } from 'vitest';
import bmi from '../src/calculators/bmi-calculator';
import mortgage from '../src/calculators/mortgage-calculator';
import { aiDiscoveryProblems, jsonLdBlocks, structuredAnswerProblems, visibleText } from '../src/lib/ai-discovery-checks';
import { calculatorMarkdown, llmsTxt, markdownPath } from '../src/lib/markdown';
import { registry } from '../src/lib/registry';
import { calculatorJsonLd } from '../src/lib/seo';

describe('markdown copy of a calculator (item 20.6)', () => {
  const md = calculatorMarkdown(bmi);

  it('has the answer-engine sections in order: inputs, default result, method, example, FAQ, citation', () => {
    const order = [
      '# BMI Calculator',
      '## Inputs',
      '## Result with the default inputs',
      '## How it is calculated',
      '## Worked example',
      '## Frequently asked questions',
      '## Cite this page',
    ];
    const at = order.map((h) => md.indexOf(h));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it('carries the default result the page shows, the method text and the health notice', () => {
    expect(md).toContain('- Your BMI: 22.9');
    expect(md).toContain(bmi.formulaDescription.trim());
    expect(md).toContain(bmi.workedExample.trim());
    expect(md).toContain('not a substitute for professional medical advice');
    expect(md).toContain('https://opuscalculator.com/calculators/bmi-calculator/');
  });

  it('gives money calculators their currency and keeps table cells on one line', () => {
    expect(calculatorMarkdown(mortgage)).toContain('Results are written in: USD');
    for (const line of md.split('\n').filter((l) => l.startsWith('| '))) expect(line.endsWith('|')).toBe(true);
  });

  it('renders for every calculator in the registry without a hole in it', () => {
    expect(registry.valid.length).toBeGreaterThan(1000);
    for (const config of registry.valid) {
      const out = calculatorMarkdown(config);
      expect(out, config.slug).toContain(`# ${config.h1}`);
      // Only the generated sections (inputs, default result): the authored FAQ may legitimately say "undefined".
      const generated = out.slice(0, out.indexOf('## How it is calculated'));
      expect(generated, config.slug).not.toMatch(/undefined|NaN|\[object/);
    }
  });
});

describe('/llms.txt (item 20.6)', () => {
  it('lists exactly the calculators it is given, grouped by category, plus the site pages', () => {
    const out = llmsTxt([bmi, mortgage]);
    expect(out).toContain('# Opus Calculator');
    expect(out).toContain(`(https://opuscalculator.com${markdownPath('bmi-calculator')})`);
    expect(out).toContain(`(https://opuscalculator.com${markdownPath('mortgage-calculator')})`);
    expect(out).not.toContain('compound-interest-calculator');
    expect(out).toContain('## Health');
    expect(out).toContain('## Finance');
    expect(out).toContain('(https://opuscalculator.com/about/)');
  });

  it('names the MCP server only when there is one', () => {
    expect(llmsTxt([bmi])).not.toContain('MCP');
    expect(llmsTxt([bmi], { mcpUrl: 'https://opuscalculator.com/mcp' })).toContain('https://opuscalculator.com/mcp');
  });
});

describe('the build fails when the AI-readable layer is wrong', () => {
  const page = (slug: string) => `<link rel="alternate" type="text/markdown" href="/calculators/${slug}.md" title="x">`;
  const pages = new Map([
    ['/calculators/a/', page('a')],
    ['/calculators/b/', page('b')],
  ]);
  const llms = (...slugs: string[]) => slugs.map((s) => `- [x](https://opuscalculator.com/calculators/${s}.md): y`).join('\n');

  it('passes when llms.txt, the markdown files and the page links agree', () => {
    expect(aiDiscoveryProblems(pages, { llms: llms('a', 'b'), markdownSlugs: new Set(['a', 'b']) })).toEqual([]);
  });

  it('names a missing llms.txt, an unlisted calculator, a missing markdown file and a missing page link', () => {
    expect(aiDiscoveryProblems(pages, { llms: undefined, markdownSlugs: new Set() })).toEqual(['dist/llms.txt is missing']);
    const problems = aiDiscoveryProblems(new Map([...pages, ['/calculators/c/', '<html></html>']]), {
      llms: llms('a', 'b'),
      markdownSlugs: new Set(['a', 'b']),
    }).join('\n');
    expect(problems).toMatch(/does not list the published calculator c/);
    expect(problems).toMatch(/c has no markdown copy/);
    expect(problems).toMatch(/\/calculators\/c\/ does not link its markdown copy/);
  });

  it('refuses an unpublished calculator in llms.txt or as a markdown file (rule 6)', () => {
    const problems = aiDiscoveryProblems(pages, { llms: llms('a', 'b', 'secret'), markdownSlugs: new Set(['a', 'b', 'secret']) }).join('\n');
    expect(problems).toMatch(/llms\.txt lists secret, which is not a published calculator/);
    expect(problems).toMatch(/secret\.md exists but secret is not a published calculator/);
  });
});

describe('structured answers match the page (item 20.8)', () => {
  const ld = calculatorJsonLd(bmi, '/calculators/bmi-calculator/', [{ label: 'Home', href: '/' }, { label: 'BMI' }]);
  const script = (data: unknown) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;

  it('adds the formula and the worked example as parts of the application, with the config text', () => {
    const app = ld['@graph'][0] as { hasPart: { name: string; text: string }[] };
    expect(app.hasPart.map((p) => p.name)).toEqual(['How it is calculated', 'Worked example']);
    expect(app.hasPart[0].text).toBe(bmi.formulaDescription);
    expect(app.hasPart[1].text).toBe(bmi.workedExample);
  });

  it('passes a page that shows that text (entities decoded) and fails one that does not', () => {
    const shown = `<main><p>${bmi.formulaDescription.replace(/&/g, '&amp;')}</p><p>${bmi.workedExample.replace(/&/g, '&amp;')}</p></main>`;
    expect(structuredAnswerProblems(new Map([['/calculators/bmi-calculator/', script(ld) + shown]]))).toEqual([]);
    expect(structuredAnswerProblems(new Map([['/calculators/bmi-calculator/', script(ld) + '<main>nothing</main>']])).join()).toMatch(
      /text is not on the page/,
    );
    expect(structuredAnswerProblems(new Map([['/calculators/x/', '<html></html>']])).join()).toMatch(/no structured formula/);
  });

  it('reads the visible text and the JSON-LD out of HTML', () => {
    expect(visibleText('<style>a{}</style><p>1 &lt; 2 &amp; 3&#39;s   ok</p><script>x</script>')).toBe("1 < 2 & 3's ok");
    expect(jsonLdBlocks(script({ a: 1 }))).toEqual([{ a: 1 }]);
  });
});
