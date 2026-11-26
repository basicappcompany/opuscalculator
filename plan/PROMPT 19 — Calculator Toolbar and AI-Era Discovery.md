# PROMPT 19 — Calculator toolbar and AI-era discovery

Added 27 Nov 2026 at the owner's request. Not part of the original plan (Prompts 0 to 18). The model is the toolbar that Omni Calculator shows on each calculator page; we build the same capabilities in our own design, not a copy of its look or code.

## Scope: every calculator

Every calculator page gets all of it: the 20 hand-written calculators, all 1,151 generated ones (1,171 in the registry today) and every calculator added later by a generator. It lives in the shared calculator page template and widget, never per calculator, so a new generator gets it for free. Published or not, the template renders it, so a page that is switched on later already has it.

## Rules that still apply

- No database, no CMS (rule 4). Nothing on this list stores anything on our side.
- The default inputs and the default result stay in the initial HTML (rule 2). The toolbar must not change that, and it must work with JavaScript for the parts that can (links), and say plainly what needs JavaScript.
- One h1, self-referencing canonical, unique title and description (rule 7). A shared-result URL and an embed page must not become duplicate indexable pages.
- No hex colour, `px` or `rem` outside `src/styles/tokens.css`. The toolbar uses the tokens and works in light and dark.
- WCAG 2.2 AA: every control is a real button or link with a name, visible focus, keyboard operable; the axe run stays at zero violations.
- Bundle budget: the widget chunk stays within the limits in `scripts/check-bundle-size.ts`. Controls that do not need the calculator's code are plain HTML or a tiny separate script.
- Anything that adds a host, a script or a stored value updates the CSP, `KNOWN_HOSTS` and `/privacy` in the same pull request.

## The controls (required on every calculator)

1. **Share this page.** The browser's share sheet; if it is missing, copy the page URL. Announce the result to screen readers.
2. **Cite this calculator.** Ready-made citation text (title, Opus Calculator, canonical URL, date accessed) in a small panel with a copy button.
3. **Share result.** A link that reopens the calculator with the visitor's current inputs. The inputs are in the query string; the canonical stays the clean page URL; the default state in the HTML is unchanged. Inputs from the link go through the same zod validators as typed input.
4. **Reset / Clear all changes.** Puts every input back to its default. Disabled (`aria-disabled`, with the reason) until something has changed.
5. **Add as a preferred source on Google.** A plain link to Google's preferred-sources setting for opuscalculator.com. Check Google's current URL before shipping; no third-party script.
6. **Helpful? Yes / No.** One question after the result. The answer is sent as an analytics event only (Plausible or Umami, whichever the owner picks, open question 12.9); nothing is stored by us and nothing is shown publicly. Until the analytics tool exists the control is not rendered. `/privacy` says exactly what is recorded.
7. **Embed code.** A copy box with an iframe snippet pointing at `/embed/<slug>/`. The embed page is the calculator alone, `noindex`, canonical to the real page, with a visible "Powered by Opus Calculator" link back. Only `/embed/*` may be framed: `public/_headers` drops `X-Frame-Options` and sets `frame-ancestors *` for that path only, and `check-security` keeps asserting everything else.

Deferred, tracked as item 20.9: thumbs up and down with a public count, and a feedback form. Both need storage or a mailbox; decide with the owner first.

## AI-era discovery (the site, not each page's toolbar)

- `/llms.txt` (and `/llms-full.txt` if useful): what the site is, the categories, how to cite it, and links to the machine-readable forms below. Published calculators only (rule 6).
- A clean markdown rendering of each published calculator at a stable URL (formula, inputs, defaults, the default result, a worked example), so answer engines and scrapers such as Firecrawl get the content without the page chrome.
- An MCP server (a Pages Function, for example `/mcp`) exposing tools to list, describe and run calculators with the same decimal.js `calculate()` functions the pages use, so an assistant's answer equals the page's. Decide before building: public or keyed, rate limit, which calculators (published only). Review CSP and `/privacy` in the same pull request.
- Structured answers for AI search (AEO, GEO): JSON-LD for the worked example and the formula, matching visible text. Not a rich-result play (FAQ rich results are limited to authoritative government and health sites).
- `robots.txt` names the AI crawlers deliberately and says what each may fetch.
- Cloudflare's Markdown for Agents and AI Crawl Control are dashboard settings for the owner.

## Methodology and references (item 20.12)

Every calculator, the simple ones too, shows a "How this works" block in the HTML and lists the references it relies on.

- Block: the formula in plain words, the assumptions, how rounding works (decimal.js), and the reference values the tests check.
- Reference: title, publisher, URL, date checked. Also in the JSON-LD.
- Never invent a source. Cite only what the formula really uses. Open and read each source before it goes in. Link and describe; do not copy their text.
- The quality gate fails a calculator with no methodology or no reference; a build check flags a reference URL that does not load.
- Scale by family: unit conversions cite NIST's SI guidance, loan maths a standard finance text, BMI the WHO and CDC definitions. YMYL categories first.
- Order: schema, gate and rendering in one pull request; then the 5 live calculators; then category by category.

## Enforcement

- `verify-dist` fails the build if any built calculator page lacks any of the required controls (it looks for each control's stable `data-toolbar` hook) or if `/embed/<slug>/` is missing for a published calculator.
- A test renders one calculator from each of the three layouts and each generator family and asserts the same toolbar.
- `npm run a11y` and `npm run e2e` cover the toolbar on the 5 live calculators.

## Order

1. Toolbar controls 1 to 5 and 7 in the template, with the verify-dist rule.
2. Helpful Yes/No once 12.9 is answered.
3. `/llms.txt`, the markdown pages and the structured answers.
4. The MCP server.

Each step is its own pull request through the normal flow: branch, `npm run verify`, one commit, one push, CI, squash-merge.
