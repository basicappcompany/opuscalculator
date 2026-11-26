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
- Tooling (23 Nov): oxlint for lint and Prettier for format (PR #19), Playwright with axe-core for browser tests on the installed Chrome. TypeScript is version 7, which `typescript-eslint` does not support, so ESLint is not used.
- Display: design tokens in `src/styles/tokens.css`; the visitor can change the currency (see CURRENCY below)
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

Renamed on 26 Nov 2026 from calculator365.net to Opus Calculator, at opuscalculator.com (owner decision, domain bought). Write the name as "Opus Calculator" in titles, the header and structured data. The old "365" wordplay and the tagline "a calculator for every day of the year" are retired: use plain copy such as "free calculators for everyday questions". The GitHub repository was renamed to `basicappcompany/opuscalculator` on 26 Nov 2026 (the old address redirects); the Cloudflare Pages project `opuscalculator` was created on 27 Nov 2026 (production branch `main`, build `npm run build`, output `dist`, automatic deployments on) and the first production deployment is live at https://opuscalculator.com (the domain's DNS is on Cloudflare; a Cloudflare redirect rule sends `www.opuscalculator.com` to the apex with a 301, and the `www` DNS record must stay proxied for it to apply); `docs/adr/004-rename-to-opus-calculator.md` records the decision. Browser storage keys are now `opus-theme`, `opus-currency` and `opus-currency-detected`.

## RELEASE FLOW

- Default branch: `main`. Remote: `origin` = https://github.com/basicappcompany/opuscalculator.git. The repository was deleted and recreated on 27 Nov 2026 with a single starting commit, so it starts from a clean history; pull request numbers cited in these docs belong to the earlier repository, and the new one starts again at #1.
- Every change after the first push goes on a new branch and is opened as a pull request. Never push to `main` directly.
- Order, every time (owner's flow, 22 Nov): branch, write code and tests, `npm run verify` green locally (lockfile check, type check, tests, build; lint joins it when PR #19 merges), ONE commit, ONE push, open the PR, wait for CI (`gh pr checks --watch`), and if CI is green squash-merge it. Never merge on red; never push a fix without running `npm run verify` again first.
- A PR that has no CI run (docs-only) is not covered by "merge if green": ask the owner. Also ask before merging anything that edits `.github/workflows` or changes how the cohort flags (`COHORT_*`) are read.
- Never commit secrets. `claude-toggle.bat` holds an API key and is git-ignored; keep it that way.
- Docs changes (`docs/status.html`, README, this file) are batched into one `docs-sync-YYYY-MM-DD` branch and PR by `/docs-sync`. That PR and any PR that edits `.github/workflows` are left open for the owner to merge (applied 23 Nov: PR #19 is such a draft, and the docs-sync PR is another).
- The repository has been public since 23 Nov. Everything in it, including history, is visible: never commit a secret, a private-registry URL or personal data.

## CI MINUTES (strict rule: save CI minutes)

- Run `npm run verify` (lockfile check, type check, tests, build) and get it green BEFORE pushing. Never use CI to find out whether something works. After any `npm install`, check `git diff package-lock.json`: npm can write non-public registry URLs into the lockfile, and they break `npm ci` on CI (`scripts/check-lockfile.mjs` catches it).
- Push as few times as possible. Batch changes into one commit per PR; never push work-in-progress, and do not push a branch and then edit it repeatedly.
- Docs-only changes (`docs/`, `*.md`, `plan/`) must not trigger CI. Any workflow added later must use `paths-ignore` for them.
- Any workflow added later: trigger on `pull_request` to `main` only (not on every push to every branch), set `concurrency` with `cancel-in-progress: true`, cache dependencies, and run one job with the minimum steps. No matrix builds, no scheduled runs, no browser tests in CI unless the owner asks.
- Cloudflare Pages also bills build minutes: it has been connected since 27 Nov (item 9.6); consider turning off preview builds for non-production branches (not yet decided; the project is at Cloudflare's default for them, not checked).
- After a DNS change on the domain, purge the Cloudflare cache (Caching, Configuration, Purge Everything): on 27 Nov a stale copy of the registrar's parking `robots.txt` stayed cached for 4 hours after the site went live.
- A minimal CI exists on main (`.github/workflows/ci.yml`, PR #2): pull requests to `main` only, `paths-ignore` for `docs/**`, `plan/**` and `**/*.md`, one job named `check` (lint, type check, tests, build, link audit, and `npm audit` only when `package.json` or the lockfile change). Changing it is a decision for the owner. Since 23 Nov the repository is public, so GitHub Actions minutes are no longer a cost; the rules above still hold because they keep CI fast, and a run is still not a way to find out whether something works.

## COMMANDS AND CONVENTIONS

- `npm run verify` = lockfile guard, type check, tests, build (the build also runs `verify-dist`). `npm run count` reports calculators per category and cohort and gate failures. `npm run audit` crawls `dist/` for orphans and bad links. Run `count`, `audit` and `verify-dist` with the same `COHORT_*` flags as the build. `npm run build` also runs the bundle budget and the security check. After a build: `npm run a11y` (axe, reflow, keyboard), `npm run audit:prelaunch` (pre-launch checks, `-- --base URL` for a deployed site), `npm run e2e` and `npm run visual` (Playwright), `npm run lighthouse` (Lighthouse on 5 random published pages, 3 mobile and 2 desktop; `-- --base URL` for a deployed site; it fetches Lighthouse with npx and is not yet proven end to end). `npm run prelaunch` lists the facts only the owner can supply. `node scripts/make-brand-assets.mjs` regenerates the favicon and social image. Pitfall found on 23 Nov: when writing a regex through a shell or a script, `\b` can become a literal backspace character; oxlint's no-control-regex rule catches it.
- "Live" has one definition, `isPublished()` in `src/lib/registry.ts`: `publish` is true AND the flag for the calculator's tier is on (cohort N is tier N, a working assumption until the build spec exists, open question 12.4).
- Programmatic calculators live in `src/generators/*.ts` (each default-exports a function returning configs); shared helpers go in `src/lib/`. Every generated config must pass the quality gate; the gate is never loosened to make a generator pass.
- When a new generator makes the intro-similarity gate exclude pages (it also excludes the older page it overlaps), fix the NEW pages: seeded scenarios with `varied()` or `mixed()` from `src/lib/spec.ts` and `spec-helpers.ts`, more specific copy, a different `introOutputs`. Never loosen the gate or edit a merged generator to make room. Two other checks catch drafts: item 11.10 forbids `.toNumber()` in a generator (use BigInt or Decimal for counts), and the purity scan rejects a `calculate()` that mentions browser names such as `window` (even as an output key). A slug that already exists in another generator fails the registry.
- The "~3,900 calculators" figure at the top is the size of Omni Calculator's English catalog, not a list the project holds. Topics for new batches should come from what competitor sites carry (the git-ignored `plan/private/competitors/`) or from the owner, not from guesses. `CalculatorConfig.audit` (set from `src/config/catalog-audit.ts`) marks the pages the 26 Nov audit judged weak or niche; it is informational and changes nothing about publishing.
- Sitemaps are custom (`src/lib/sitemaps.ts`), by tier and category; `@astrojs/sitemap` is not used.

## PROMOTION GATE (enforced in code, Prompt 8)

- Cohort 2 may publish only when Cohort 1 indexation is above 40% AND at least 20% of Cohort 1 pages have organic clicks. The same rule applies to Cohort 3 against Cohort 2. Below 30% indexation a cohort is demoted: switch the worst clusters off and set them to noindex (Appendix B).
- It is enforced, not remembered: `src/config/rollout.ts` throws, and so the build fails, if `COHORT_2_PUBLISHED` or `COHORT_3_PUBLISHED` is true and `src/config/promotion-gate.json` does not say the promotion is allowed or is older than 14 days. That file is written by `npm run gate` from a real `indexation.csv` (made weekly by `npm run indexation`, which needs `SEARCH_CONSOLE_CREDENTIALS` on the owner's machine only). Commit it through a pull request when promoting, so the evidence is in the diff.
- `PROMOTION_GATE_SKIP=local-only` lets a developer build with the flags on for testing; it is ignored when `CI` or `CF_PAGES` is set. Never set a cohort flag to true in Cloudflare Pages on a hunch.
- Pruning: a page with zero impressions and zero clicks for 90 days, in the sitemaps for at least 90 days, gets noindex (still crawlable and linked) through `src/config/pruned.json` (`npm run prune`). Deleting a page uses 410 Gone via `src/config/gone.json` and `functions/_middleware.ts`, never 404. The dashboard is a local file (`npm run dashboard`, output in `reports/`), not a deployed page.

## DESIGN RULES (Prompt 13)

- One source of truth for design tokens: `src/styles/tokens.css` (colour, type scale, radii, shadows, fonts, spacing), light and dark. No hex colour, `px` or `rem` value in a component, layout or page file: use the tokens through Tailwind utilities (`bg-card`, `text-fg`, `border-border`, `rounded-lg`). A test fails on a violation. The old `ink/line/surface/brand` names are now `fg/border/card/accent`.
- Dark mode follows the system and can be set with the header toggle (`aria-pressed`, `localStorage` key `opus-theme`, applied by an inline script in `<head>` before paint). The theme is a `data-theme` attribute on `<html>`.
- Every calculator widget has a default state (defaults and the default result, in the HTML), an invalid state (inline error, the last valid result kept and tagged "stale") and a disabled state (a field being solved for is `aria-disabled` with an explanation).
- 404 and 500 pages are `noindex` and in no sitemap. A static host cannot return HTTP 500 by itself; `500.astro` says so.
- Bundle budget, enforced in the build (`scripts/check-bundle-size.ts`): the widget chunk at most 45 KB gzipped, and the widget plus everything it loads except React at most 66 KB. Which one the plan's "45 KB" meant is open question item 14.9.
- `docs/ui-demo.html` is the approved visual reference.

## CURRENCY (owner request, 23 Nov)

- Every calculator that shows money can show any currency; USD is the default and the visitor chooses. Do not hardcode `$` in new calculators, labels or output: use `fmtCurrency()` (it follows the visitor's choice through `withCurrency`) and write labels as `Amount ($)` so the widget can swap the symbol. `currencyOf()` finds money calculators by running `calculate()` with another display currency; a country page sets `currency` on its config.
- Symbol and formatting only: typed numbers are never converted. The server HTML always ships the calculator's own currency (rule 2); the chosen or detected currency re-formats in the browser after load. Detection uses Cloudflare's `/cdn-cgi/trace` then the browser language, never the browser's geolocation prompt, and is skipped on local hosts.
- No flags for currencies. A future language picker uses language names, not flags.

## YMYL RULES (Prompt 12)

- Every calculator in a YMYL category (health, finance, tax, legal, construction, chemistry, food, biology) renders a category disclaimer in the initial HTML, directly below the results card and above the ad slot, as `<aside role="note" class="disclaimer">`: not a modal, not a tooltip, not JavaScript-rendered. Texts are in `src/content/disclaimers.ts`. Non-YMYL categories (math, physics, conversion, everyday-life, statistics, sports, ecology) show none.
- Every YMYL page shows "Last reviewed: <date>" and, if a reviewer exists (`src/content/reviewers.ts`), "Reviewed by <name>, <credentials>". Never invent a reviewer or credentials. With no reviewer the date is the calculator's `lastUpdated` and the editorial policy's "Unaudited calculators" section is the stated review process.
- Every YMYL calculator's JSON-LD has `lastReviewed` (on a WebPage node that points at the WebApplication) and `reviewedBy` only when a reviewer exists; every calculator's JSON-LD has the publisher.
- Every page links /about, /contact, /editorial-policy, /how-we-make-money, /privacy, /terms, /ad-disclosure, /accessibility and /dmca from the footer. `verify-dist` fails the build if any built page lacks one. The list is `src/lib/static-pages.ts`, which also drives the sitemap.
- Facts only the owner can supply (jurisdiction, mailboxes, legal review) live in `src/config/site.ts`; `npm run prelaunch` lists what is open.

## ACCESSIBILITY RULES (Prompt 14)

- WCAG 2.2 AA is the target. `npm run a11y` (needs a build) must report zero axe violations of any impact on 8 pages in light and dark and the widget's error state, no sideways scroll at 320 px and 640 px, the skip link as the first tab stop, no focus trap, the ad slot never focused, and a live region that is silent while typing and announces once the result has held still for 400 ms.
- Every input has a label; every error is linked with `aria-describedby`; typed fields are `aria-required`. Scrollable regions are `role="region" tabindex="0"` with a label. Contrast is at least 4.5:1 for text and 3:1 for control outlines and the focus ring, in both themes (tested).
- Tooling is axe-core through Playwright on the installed Chrome. `pa11y` and `@axe-core/cli` are deliberately not installed.

## SECURITY RULES (Prompt 15)

- `public/_headers` sets HSTS (max-age 63072000, includeSubDomains, preload), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, a Permissions-Policy that denies camera, microphone and geolocation, `X-Frame-Options: DENY` and a CSP. The CSP allows only third parties in use (today `https://plausible.io`); adding an ad network means adding exactly its hosts in the same change and updating /privacy. `npm run build` fails on a missing or weakened header, an unexplained CSP host, a page that loads a script the CSP forbids, a secret value or credential shape in `dist/`, or a `PUBLIC_` variable with a secret-looking name (`scripts/check-security.ts`).
- Anything prefixed `PUBLIC_` is visible to every visitor. `.env.example` lists every variable the code reads, names only. A leaked secret is rotated, not just removed.
- `/admin/*` answers 401 without a Cloudflare Access token (`functions/_middleware.ts`, a second lock behind Access itself).
- Every calculator input has a zod validator; the quality gate rejects one that does not.
- `npm audit --audit-level=high` must pass.

## CI/CD RULES (Prompt 16)

- What is enforced on main (PR #19): one CI job named `check` (oxlint, type check, tests, build, link audit, and `npm audit` when dependencies change), run on pull requests only. Lint is oxlint because typescript-eslint does not support TypeScript 7. Prettier runs on commit (husky and lint-staged), Dependabot opens weekly update pull requests with plain `Deps:` and `CI:` titles, there is a PR template, and an inert Cloudflare preview workflow (`preview.yml`, off until `CF_PREVIEW=true` and the Cloudflare secrets exist). Browser tests (a11y, e2e, visual) are not in CI by the owner's decision of 23 Nov; run them locally before a release.
- Not adopted from the plan, on purpose: required approving reviews (one maintainer cannot approve their own pull requests), and Conventional Commits enforcement (the whole history uses plain titles). Branch protection to set: require status checks, linear history, no force pushes (README "Branch protection").
- Dependabot pull requests get the normal flow, and a human review within 5 business days.

## OBSERVABILITY RULES (Prompt 17)

- Browser tests: `npm run e2e` types inputs, waits for the debounced result and asserts exact rendered numbers, with an axe scan per calculator; `npm run visual` compares 12 screenshots (layouts A, B and C, light and dark, desktop and mobile) and its baselines are Windows renderings. Both use `playwright.config.ts` and the installed Chrome. `npm run e2e` pins the chosen currency to USD (the `openCalculator` helper), so it also passes on a deployed site, where the page otherwise re-formats to the detected currency: `E2E_BASE_URL=https://opuscalculator.com npm run e2e -- --project=chromium`. Firefox, WebKit and mobile Safari projects exist and need `npx playwright install firefox webkit`.
- Error monitoring and uptime need accounts the owner has not created (items 18.4 and 18.5). If Sentry is added: `tracesSampleRate` 0.1, no session replay, enabled only when `SENTRY_DSN` is set, its host added to the CSP and named in /privacy. Uptime: the home page, a calculator and the sitemap every 60 seconds, alert after 2 consecutive failures.
- `npm run audit:prelaunch` checks the pre-launch items locally or, with `-- --base https://opuscalculator.com`, a deployed site.

## LEGAL AND OPERATIONAL RULES (Prompt 18)

- /privacy, /terms, /ad-disclosure, /accessibility and /dmca exist, are linked from every footer and are in the sitemap. Privacy must match what the site really does: cookie-free analytics, what is stored on the device (`opus-currency`, `opus-currency-detected`, `opus-theme`), the ad network's cookies once ads are on, hosting logs, GDPR and CCPA rights. Change it in the same pull request as any change to analytics, ads, storage or monitoring.
- Ad Disclosure says the site is funded by ads, ads sit below the calculator, no calculator needs an ad click, and ads never influence a result.
- Architecture decisions live in `docs/adr/`: dated, signed, never edited after merge (a superseded ADR is marked, not deleted). Incident, rollback and on-call notes are `docs/INCIDENT_RUNBOOK.md`, `docs/ROLLBACK.md` and `docs/RUNBOOK_ONCALL.md`; the rollback steps have not been rehearsed (item 19.6): only one production deployment exists, so there is nothing to roll back to yet.
