# UX audit and design directions

Written 27 Nov 2026 for the owner to decide on (item 20.13). Evidence: screenshots of the live site on a 390 px phone and a 1280 px desktop (home, three calculator layouts, the finance hub, a static page), a read of the page code, and the checks already in the repo (no sideways scroll at 320 and 640 px, axe clean, Lighthouse 97 to 100 for performance). The three mockups are in [`ux-directions.html`](ux-directions.html): one file, open it in a browser.

## What is already good

- Fast and accessible: Lighthouse performance 97 to 100, axe clean in light and dark, nothing scrolls sideways on a phone, the default result is in the HTML.
- A consistent, restrained look with a sensible dark mode, a visible focus ring, and real labels on every input.
- The content is strong: every page has a formula, a worked example and an FAQ, and the claims are tested.

## Findings (most important first)

| #   | Where                      | What a visitor sees                                                                                                                                                     | Why it matters                                                                                                                                        | Fix (in all three directions)                                                                                                            |
| --- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Calculator page, **phone** | The first screen is a title, an 11-line intro paragraph and the toolbar. The inputs start below the fold.                                                               | The tool is the reason for the visit; on a phone nobody scrolls past three paragraphs to find a field.                                                | Tool first: one-line lede, inputs and result in the first screen, the long text below the tool.                                          |
| 2   | Calculator page, desktop   | In Layout B the result card sits below the inputs, below the fold at 800 px high.                                                                                       | The answer is the product.                                                                                                                            | Inputs and result side by side on desktop; a sticky result bar on a phone.                                                               |
| 3   | All calculator pages       | Seven or more outline buttons of equal weight (Share, Cite, Embed, Add as a preferred source on Google, Clear, Copy, Share result).                                     | No hierarchy: nothing says what to do next. "Add as a preferred source on Google" is the widest button and the least useful.                          | One primary action (Share result); the rest in a quiet row or a "More" menu; the Google link moves to the page footer or the About page. |
| 4   | Home                       | A headline, one sentence and four title-only category cards, then a plain list of five calculators.                                                                     | There is no search, no live example, no sense of scale, and nothing that shows the AI and agent side. A visitor cannot try anything on the home page. | A search/command bar, popular tasks as chips, category cards with counts and examples, and a visible "use from your AI assistant" entry. |
| 5   | Everything                 | No search or command palette.                                                                                                                                           | At 1,156 calculators, browsing categories will not work.                                                                                              | Static search over `/calculators.json` (already built) with `/` to focus; later, natural-language routing.                               |
| 6   | Hubs                       | Cards in a narrow column with a lot of empty space; one card per subheading.                                                                                            | Looks unfinished with 1 to 2 calculators per group (5 live today).                                                                                    | Denser grid, a short intro, "popular" first; hide empty subheadings.                                                                     |
| 7   | Copy                       | The intro is shown twice (as the lede, then again as "About this calculator"). The home page says "free calculators" in the heading and again in the sentence under it. | Repetition reads as filler; it also pushes the tool down (finding 1).                                                                                 | One-sentence lede from the first sentence of the intro; the rest under "About".                                                          |
| 8   | Header                     | A currency selector with a visible "INR · ₹" (detected) on every page, even on pages with no money in them.                                                             | Confusing on a BMI page; a detected value the visitor never chose.                                                                                    | Show it only on calculators that handle money; keep detection, show "Results in INR" in the result area.                                 |
| 9   | AI and agents              | Nothing on the pages tells a visitor (or their assistant) that the site has an MCP server, `/llms.txt`, markdown copies or JSON.                                        | The capability is built and invisible.                                                                                                                | A "Use with AI" entry on each calculator and the home page: copy the MCP address, a ready-made prompt.                                   |
| 10  | Robustness                 | The home page rendered unstyled once during a capture taken right after a deploy; four later captures were fine.                                                        | Likely a moment when the old stylesheet was gone and a cached page still pointed at it. Not reproduced.                                               | Keep an eye on it; not a design issue.                                                                                                   |
| 11  | Console                    | Every page logs one error: Cloudflare's analytics script is blocked by our CSP (item 16.9, waiting for the owner).                                                      | Noise, and 7 Lighthouse points.                                                                                                                       | Turn off Cloudflare Web Analytics in the project.                                                                                        |

## What "modern" should mean here (principles all three follow)

1. **Answer first.** The number and its source are on the first screen; the explanation follows. This is also what AI assistants quote.
2. **One question per screen on a phone.** Inputs, then the result pinned or directly below, then actions. Nothing that needs a second scroll before the first result.
3. **Show the working.** Formula, worked example, assumptions and sources are part of the product, not footnotes (item 20.12). It is the reason to trust this site over a generic answer.
4. **Humans and agents get the same truth.** Every page has a markdown copy, a JSON index and an MCP tool that runs the same code. The interface says so plainly and offers it without jargon.
5. **Fewer, calmer controls.** One primary action, quiet secondary actions, no decorative buttons.
6. **Keyboard and touch both first-class.** `/` to search, visible focus, large touch targets, no hover-only controls.
7. **Motion only to explain.** A result that changes should be visibly connected to the input that changed it; nothing else animates.

## The three directions

|                 | A · Calm Precision                                                                | B · Answer Engine                                                                                      | C · Instrument                                                                          |
| --------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| Feel            | Editorial, light, quiet, serif display, one accent                                | Dark-first, conversational, glowing accent                                                             | Dense, neutral, a pro tool                                                              |
| Home            | Search bar, task chips, rich category cards, an "Use from your AI assistant" band | One question box that answers inline with its source                                                   | Command bar, a table of categories with counts                                          |
| Calculator page | Tool and an oversized result first; actions in one row; explanation below         | "Ask in words" line, inputs and result in cards, an agent panel with the MCP address                   | Three columns: inputs, result with a scale and a scenario table, actions with shortcuts |
| Phone           | Stacked, result directly under the inputs                                         | Stacked cards                                                                                          | Inputs with a sticky result bar                                                         |
| Best for        | Trust (health and finance), a broad audience                                      | An "AI-native" identity                                                                                | Heavy and repeat users, comparing scenarios                                             |
| Main risk       | Can feel plain                                                                    | Natural-language routing is new work; a wrong routing on a health or finance question would hurt trust | Least friendly for first-time visitors; the hardest on phones                           |
| Build size      | Smallest: restyle and re-order what exists, add search and the AI band            | Largest: new routing, an answer card, a new home                                                       | Medium: a new calculator layout and a command palette                                   |

## Recommendation

**Start from A, and borrow two ideas from the others.** A fixes findings 1 to 8 with the least risk and keeps the trust signals that health and finance pages need. From B take the "Use with your assistant" panel (finding 9), because it is cheap and it is the capability nobody can see. From C take the keyboard shortcuts and the comparison table as a later addition on the calculators where comparing scenarios matters (mortgage, loans, compound interest).

Do natural-language routing (B's question box) only after the exact, sourced calculators are in place and the routing can be checked against them; until then a search bar is enough.

## What the rebuild (item 20.14) would involve once you choose

Design tokens first (one source of truth in `src/styles/tokens.css`, light and dark), then the shared components (header, search, toolbar, result card, sources), then the three calculator layouts, the home page, hubs and static pages, then the browser suites (visual baselines re-recorded, axe, keyboard, reflow at 320 px). Rough size: 8 to 14 hours of work in several pull requests, each checked on a phone and a desktop.

## Decisions for you

1. Which direction, or which mix? (My pick: A, with B's assistant panel.)
2. Keep the serif display face in A, or stay with the sans-serif already in use?
3. Should the Google "preferred source" link stay on every calculator (it is the least useful button)?
4. Show the currency selector only where money is involved (finding 8)?
