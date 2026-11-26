Scaffold a programmatic-SEO calculator site for the domain opuscalculator.com. Before writing any code, create CLAUDE.md at the repo root and write the following into it verbatim. Every later session will inherit these constraints.

--- BEGIN CLAUDE.md CONTENT ---

# Opus Calculator (opuscalculator.com)

A programmatic-SEO calculator platform. ~3,900+ calculators across 14 categories. Free to use, monetized with one ad unit per page.

## STACK (do not deviate without asking)
- Framework: Astro (latest), static output
- Language: TypeScript, strict mode
- Styling: Tailwind CSS
- Interactive widget: React island via @astrojs/react, using shadcn/ui primitives
- Precision: decimal.js for ALL numeric output. Never use raw JS floats for currency, percentages, BMI, or dosage.
- Database: NONE. Calculator definitions are TypeScript config files compiled at build time.
- Hosting: Cloudflare Pages
- Analytics: Plausible or Umami — one lightweight cookieless script
- Ads: one ad slot per page, lazy-loaded after the calculator is interactive
- Canonical base URL: https://opuscalculator.com

## NON-NEGOTIABLE RULES
1. A calculator cannot be published unless validateForIndexing() returns pass. Unpublished pages return 404 and never appear in a sitemap.
2. Default inputs and the default computed result must exist in the initial HTML. No client-side-only rendering of the calculator or its answer.
3. All numeric output uses decimal.js. Raw JS floats are forbidden for currency, percentage, BMI, dosage, and ratios.
4. No database, no CMS. Calculators are TypeScript objects in src/calculators/ and src/generators/.
5. Cohort-gated rollout. Cohort 2 does not publish until Cohort 1 indexation > 40% and >= 20% of Cohort 1 pages have organic clicks.
6. Never link to an unpublished page from a hub, a related module, or a sitemap.
7. One h1 per page. Semantic HTML. Self-referencing canonical. Unique title and meta description.
8. Never use Google's Indexing API — it is restricted to JobPosting and BroadcastEvent. Discovery is sitemaps plus internal links only.

## BRAND POSITIONING
Brand: the project is Opus Calculator at opuscalculator.com. Write the name as "Opus Calculator" in titles, the header and structured data, and use plain copy such as "free calculators for everyday questions" (the earlier "365" wordplay is retired).

--- END CLAUDE.md CONTENT ---

Then scaffold:
1. npm create astro@latest . -- --template minimal --typescript strict --install
2. Add integrations: @astrojs/react, @astrojs/tailwind, @astrojs/sitemap
3. Install decimal.js, zod, and the shadcn/ui dependencies (class-variance-authority, clsx, tailwind-merge, lucide-react)
4. Create these folders and files:
    - src/calculators/
    - src/generators/
    - src/lib/types.ts
    - src/lib/quality-gate.ts
    - src/lib/registry.ts
    - src/components/calculator/
    - src/components/calculator/layouts/
    - src/pages/calculators/[slug].astro
    - src/pages/categories/[category].astro
    - src/config/rollout.ts
    - scripts/
5. Create src/lib/quality-gate.ts exporting validateForIndexing(config) that returns { pass: boolean, reasons: string[] } and checks:
    - intro is at least 150 words
    - Jaccard similarity of this intro against every other intro is below 0.3
    - at least 3 FAQ entries, none identical to another calculator's FAQ
    - slug does not collide
    - calculate() is a pure function (no fetch, no window, no Date.now outside a passed-in parameter)
6. Set site: 'https://opuscalculator.com' in astro.config.mjs.
7. Commit and tell me the command to run the dev server.