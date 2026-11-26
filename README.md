# Opus Calculator (opuscalculator.com)

Free calculators for everyday questions. A programmatic-SEO calculator site: static output, no database, one ad unit per page. The rules the project is built under are in [`CLAUDE.md`](CLAUDE.md), the plan is in [`plan/`](plan/), and the live progress tracker is [`docs/status.html`](docs/status.html) (open it straight from disk).

## Stack

Astro 7 (static output), TypeScript strict, Tailwind CSS 4 via `@tailwindcss/vite`, one React island (`@astrojs/react`), `decimal.js` for all numeric output, `zod` for input validation, KaTeX rendered at build time, Vitest, and Playwright with axe-core for browser tests. TypeScript is version 7. Hosting target is Cloudflare Pages (not connected yet). Needs Node 22.23.4 or newer. The repository is public.

## Commands

| Command                   | Action                                                                                                                                               |
| :------------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm install`             | Install dependencies. Afterwards check `git diff package-lock.json` (see Release flow).                                                              |
| `npm run dev`             | Dev server at `localhost:4321`                                                                                                                       |
| `npm run typecheck`       | `astro sync` then `tsc --noEmit` (`.astro` files are not type-checked)                                                                               |
| `npm test`                | Vitest, all test files                                                                                                                               |
| `npm run build`           | `astro build` to `dist/`, then `verify-dist`, which fails the build on any bad sitemap URL or link to an unpublished page                            |
| `npm run verify`          | Lockfile guard, type check, tests and build (the build also checks links, the bundle budget and security). Green before every push.                  |
| `npm run count`           | Calculators per category and cohort, live count, closest pair of intros, quality-gate failures with reasons                                          |
| `npm run audit`           | Crawls `dist/`: orphan pages, pages with fewer than 3 inbound links, sitemap-only pages, links to unpublished pages                                  |
| `npm run indexation`      | Weekly: ask Search Console about every published URL, write `indexation.csv` (needs `SEARCH_CONSOLE_CREDENTIALS`; `-- --mock file.csv` is a dry run) |
| `npm run gate`            | Evaluate the promotion gate from `indexation.csv` and write `src/config/promotion-gate.json`                                                         |
| `npm run dashboard`       | Render `reports/indexation.html`, a local file (never deploy it)                                                                                     |
| `npm run prune`           | List pages with 0 impressions and 0 clicks for 90 days; `-- --write` adds them to `src/config/pruned.json`                                           |
| `npm run preview`         | Serve `dist/` locally                                                                                                                                |
| `npm run a11y`            | After a build: axe-core, reflow, keyboard and live-region checks in Chrome; fails on any violation                                                   |
| `npm run e2e`             | After a build: Playwright specs that assert exact numbers (`-- --project=chromium` for one browser)                                                  |
| `npm run visual`          | After a build: 12 screenshot comparisons (Chromium, Windows baselines)                                                                               |
| `npm run audit:prelaunch` | After a build: the pre-launch checks; `-- --base https://opuscalculator.com` runs them on a deployed site                                            |
| `npm run lighthouse`      | After a build: Lighthouse on 5 random published pages (3 mobile, 2 desktop); `-- --base URL` for a deployed site; fails under 90 on mobile           |
| `npm run prelaunch`       | Lists the facts only the owner can supply (jurisdiction, legal read-through, reviewers)                                                              |

`count`, `audit` and the build's `verify-dist` read the cohort flags like the build does, so run them with the same flags the build used (for example `COHORT_2_PUBLISHED=true npm run audit` after a build with that flag), or live pages will be reported as unpublished.

## Layout

```text
src/calculators/   one TypeScript config per hand-written calculator (definition, formula and copy)
src/generators/    programmatic configs: each file default-exports a function returning CalculatorConfig[]
src/content/categories/   hub copy, one file per category (800 to 1,200 words each)
src/lib/           registry, quality gate, SEO and JSON-LD, hubs, sitemaps, linking, audit, indexation and pruning logic, spec helper, helpers
functions/         Cloudflare Pages Function: 410 Gone for deleted pages, 401 for /admin without an Access token
src/components/    widget (React island), layouts A/B/C, ad slot, disclaimer, header currency and theme controls
src/content/       category hub copy, YMYL disclaimers and reviewers
src/config/        rollout flags, promotion gate, pruned and gone lists, site facts (jurisdiction, mailboxes)
src/styles/        tokens.css, the one source of design tokens
src/pages/         home, calculators/[slug], categories/[category], about, policy and legal pages, 404, 500, sitemap endpoints
public/            favicon, social image, robots.txt and _headers (security headers)
scripts/           count-calculators, link-audit, verify-dist, check-security, check-bundle-size, a11y, prelaunch-audit, check-lockfile, run.mjs (runs a .ts script through Vite)
tests/             calculator tests plus registry, generator, layout, widget, SEO, currency, security, design-token and audit tests; tests/e2e and tests/visual are Playwright
docs/status.html   progress tracker; `/docs-sync` keeps it current
docs/              also: ui-demo.html (approved look), DISTRIBUTION.md, ACCESSIBILITY_AUDIT.md, adr/, INCIDENT_RUNBOOK.md, ROLLBACK.md, RUNBOOK_ONCALL.md
plan/              the build plan (Prompts and Appendices)
```

## Adding a calculator

1. Create `src/calculators/<slug>.ts` that default-exports a `CalculatorConfig` (see `src/lib/types.ts` and any existing file, for example `percentage-calculator.ts`). `calculate()` must be pure, use `decimal.js` through `src/lib/decimal.ts` and `src/lib/format.ts`, and return formatted strings.
2. Add `tests/calculators/<slug>.test.ts` with the default case, at least three more known answers and a decimal-precision assertion.
3. Leave `publish: false` until it passes `validateForIndexing()` (intro of at least 150 words, intro not too similar to another, 3 or more FAQ entries that are not duplicated on other pages, pure `calculate()`, unique slug). The registry excludes a calculator that fails and logs why. Unpublished calculators have no page and are never linked or put in a sitemap.
4. To publish, set `publish: true`. The page is built at `/calculators/<slug>/` and its category hub lists it. It is live only if the flag for its tier's cohort is on (Tier 1 is on by default).

## Adding a generator

1. Create `src/generators/<name>.ts` whose default export is a function returning `CalculatorConfig[]`. Most generators export `SPECS` (a list of `Spec` objects: copy, inputs, formula, scenarios and at least 3 known answers in `checks`) and map them with `defineCalculator` from `src/lib/spec.ts`; `tests/generators/specs.test.ts` then tests every spec automatically. The registry picks it up automatically. Put shared helpers in `src/lib/` (for example `gen-utils.ts`), not in `src/generators/`, because every file there is treated as a generator. `units.ts` is the working example.
2. Set `publish: true`, a `tier` (2 or 3: cohort N is tier N, a working assumption, see open question 12.4 in the tracker) and a `subCluster` (the group on the category hub and the source of sibling links). Slugs must not collide with a hand-written page; the registry throws on a duplicate.
3. Every generated config must pass the quality gate. The gate compares distinct words in intros (Jaccard, limit 0.3), so templated copy needs per-page content (numbers, unit facts) and several phrasings per sentence slot; copy chosen by `pick()` or `hash32()` from `src/lib/gen-utils.ts` is stable between builds.
4. Add a test file under `tests/generators/` (see `units.test.ts`): counts, unique slug/title/description/h1, known values, and that `registry.excluded` is empty. Run `npm run count` to see totals and the closest pair.

## Sitemaps and robots

`sitemap-index.xml` lists `sitemap-pages.xml` (home and hubs), `sitemap-tier1.xml` and `sitemap-tier{2,3}-<category>.xml`, each split at 50,000 URLs, containing published URLs only. They come from `src/lib/sitemaps.ts` and two endpoints in `src/pages/`. `public/robots.txt` allows the named crawlers and disallows `?sort=`, `?filter=` and `?page=`. Discovery is sitemaps plus internal links only; Google's Indexing API is not used (CLAUDE.md rule 8).

## Category hubs

Each hub's copy lives in `src/content/categories/<category>.ts`. A hub renders only when its category has a published calculator, and a hub with calculators but under 800 words of analysis fails the build. Sub-clusters, the "most used" blurbs and the decision guide are keyed by calculator slug in the same file and show only for published calculators; generated pages are grouped by their own `subCluster`.

## Promoting a cohort (enforced by the build)

Cohort 2 may publish only when cohort 1 is above 40% indexed and at least 20% of its pages have organic clicks; cohort 3 likewise against cohort 2 (CLAUDE.md rule 5). `src/config/rollout.ts` fails the build if `COHORT_2_PUBLISHED` or `COHORT_3_PUBLISHED` is true without a fresh, allowing `src/config/promotion-gate.json`.

1. After the site is deployed and verified in Search Console, run `npm run build` then `npm run indexation` every week (set `SEARCH_CONSOLE_CREDENTIALS` on your own machine; never commit it). Run `npm run dashboard` to read the result.
2. When you want to promote, run `npm run gate`. If it says ALLOWED, commit the changed `promotion-gate.json` in a pull request, then set the flag in Cloudflare Pages. The gate file expires after 14 days.
3. `PROMOTION_GATE_SKIP=local-only` lets you build with the flags on for testing on your own machine; it is ignored on CI and Cloudflare Pages.

Pruning and deleting: `npm run prune -- --write` records pages for noindex (they stay linked). To delete a page, add its path to `src/config/gone.json`; the Cloudflare Pages Function in `functions/` then answers 410 (not yet tested on Cloudflare).

## Environment variables

| Variable                     | Purpose                                                                                  |
| :--------------------------- | :--------------------------------------------------------------------------------------- |
| `COHORT_1_PUBLISHED`         | Defaults to `true`. Read in `src/config/rollout.ts`.                                     |
| `COHORT_2_PUBLISHED`         | Defaults to `false`. Do not set it until the promotion gate is met (`CLAUDE.md` rule 5). |
| `COHORT_3_PUBLISHED`         | Defaults to `false`.                                                                     |
| `PLAUSIBLE_DOMAIN`           | If set, the base layout adds one Plausible script tag. Unset means no analytics.         |
| `NODE_VERSION`               | Cloudflare Pages only: set to `22`.                                                      |
| `PUBLIC_AD_SCRIPT_URL`       | If set, the deferred ad loader injects this script. Unset means an empty placeholder.    |
| `SEARCH_CONSOLE_CREDENTIALS` | Service account JSON for `npm run indexation`. Your machine only; never committed.       |
| `SEARCH_CONSOLE_SITE`        | Search Console property, default `https://opuscalculator.com/`.                          |
| `PROMOTION_GATE_SKIP`        | `local-only` skips the promotion gate for a test build; ignored on CI and Cloudflare.    |

`.env.example` lists every variable the code reads, names only; never put a real value in it. Anything prefixed `PUBLIC_` is visible to every visitor. The flags are applied by `isPublished()` in `src/lib/registry.ts`: a page is live when `publish` is true and its tier's flag is on, and `rollout.ts` refuses to start a build that turns on cohort 2 or 3 without the promotion gate. The canonical host is written in `astro.config.mjs` and `src/lib/seo.ts`, not read from the environment.

## Deploying to Cloudflare Pages

Not connected yet (tracker items 9.6 and 9.7). When you create the Pages project from the GitHub repository, use exactly these settings:

| Setting                | Value                                                                                                                                                                                                |
| :--------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production branch      | `main`                                                                                                                                                                                               |
| Framework preset       | None (or Astro; the build command below is what counts)                                                                                                                                              |
| Build command          | `npm run build` (runs `astro build`, then `verify-dist`, the bundle budget and the security check, and fails on any of them)                                                                         |
| Build output directory | `dist`                                                                                                                                                                                               |
| Root directory         | leave blank                                                                                                                                                                                          |
| Environment variables  | `COHORT_1_PUBLISHED=true`, `COHORT_2_PUBLISHED=false`, `COHORT_3_PUBLISHED=false`, `PLAUSIBLE_DOMAIN=opuscalculator.com` (only after you choose the analytics tool, tracker 12.9), `NODE_VERSION=22` |

- The `functions/` folder is picked up automatically. `dist/_routes.json`, written by the build, sends only `/admin/*` and the gone paths to it, so every other request is a plain static file.
- `public/_headers` becomes the response headers (security headers and long caching for hashed assets).
- `SITE_URL` appears in the plan's Appendix A but nothing reads it: the address is written in `astro.config.mjs` and `src/lib/seo.ts`. Setting it on Cloudflare does nothing.
- Cloudflare bills build minutes. With the repository public you can turn off preview builds for branches other than `main` (Settings, Builds, Branch control) if you do not use previews.
- Do not set `PUBLIC_AD_SCRIPT_URL` until an ad network is chosen (12.11) and `/privacy` and the CSP are updated for it.

After the first deploy, run the checks that cannot run before it: `npm run audit:prelaunch -- --base https://opuscalculator.com --sample 20`, and `curl -I` on `/`, on a made-up URL (must be 404) and on `/admin/` (must be 401 or the Access login).

## Protect /admin (Cloudflare Access)

There is no deployed admin page yet: the indexation dashboard is rendered locally (`npm run dashboard`, tracker 12.10). If you decide to deploy one, put Cloudflare Access in front of it first:

1. Cloudflare dashboard, Zero Trust, Access, Applications, Add an application, Self-hosted.
2. Application domain `opuscalculator.com`, path `admin/*`.
3. Add a policy: action Allow, include your email address (One-time PIN login needs nothing else).
4. Save, then test: `curl -I https://opuscalculator.com/admin/indexation` without a token must answer 401 or redirect to the Access login. A signed-in browser must reach the page.

`functions/_middleware.ts` is a second lock: it answers 401 to any `/admin/` request that has no Cloudflare Access token, so removing the Access rule by mistake fails closed. It checks that a token is present; verifying its signature would need your Access team domain and audience tag.

## Security

`public/_headers` sets HSTS (preload), `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options: DENY` and a Content-Security-Policy. The only third party in the CSP is `https://plausible.io`. To add one (an ad network, an error monitor), add exactly its hosts to the CSP **and** to `KNOWN_HOSTS` in `scripts/check-security.ts` with the reason, and update `/privacy`; the build fails if you forget either.

`npm run build` also fails if a secret value or credential shape (private key, service-account JSON, AWS, Anthropic, GitHub or Slack token) appears in `dist/`, or if a `PUBLIC_` variable has a secret-looking name. `.env.example` lists every variable the code reads (names only). `npm audit --audit-level=high` must pass.

## Accessibility and browser tests

All of these need a build first and use the Google Chrome already installed (Playwright's `chrome` channel), so there is nothing to download. Set `CHROME_PATH` to use another.

- `npm run a11y`: axe-core on 8 pages in light and dark plus the widget's error state (zero violations of any impact), no sideways scroll at 320 and 640 px, the keyboard tab order (skip link first, no trap, the ad slot never focused), and the live-region timing. The tab-order tables are written to `reports/a11y/`; the audit of 23 Nov is in [`docs/ACCESSIBILITY_AUDIT.md`](docs/ACCESSIBILITY_AUDIT.md).
- `npm run e2e`: one spec per Tier 1 calculator in `tests/e2e/`, typing inputs and asserting the exact rendered numbers, each with an axe scan. `-- --project=chromium` runs one browser. Firefox, WebKit and mobile Safari need `npx playwright install firefox webkit` once.
- `npm run visual`: 12 screenshots (layouts A, B and C, light and dark, desktop and mobile) against baselines in `tests/visual/layouts.spec.ts-snapshots/`. The baselines are Windows renderings; on another system run `npm run visual -- --update-snapshots` once and review the images.
- `npm run lighthouse`: Lighthouse 12 (fetched with `npx` at run time, not a dependency) on 5 random pages from the sitemaps, 3 mobile and 2 desktop, on the installed Chrome; the local server compresses with Brotli and caches like Cloudflare Pages. It fails if a mobile page scores under 90 for performance. `-- --base https://opuscalculator.com` runs it on a deployed site, which is the run that counts for launch. It has not yet been proven end to end.
- `npm run audit:prelaunch`: the pre-launch checks (200 and 404, sitemaps, links, one h1 and canonical and JSON-LD, the default result in the raw HTML, the ad slot below the fold). `-- --base https://opuscalculator.com` runs it on a deployed site.
- `E2E_BASE_URL=https://<preview>.pages.dev npm run e2e` runs the E2E suite against a deployed preview instead of the local build.

## Currency and theme

Any calculator that shows money can show any of 31 currencies. USD is the default; the header selector (and the "Change" link in each widget) changes it. Only the symbol and number format change, never the typed amounts. The choice is kept in `localStorage` (`opus-currency`); with no choice the currency is detected from Cloudflare's country (`/cdn-cgi/trace`) or the browser language (never the geolocation prompt, and not on localhost). The server HTML always ships the calculator's own currency. In code: `src/lib/currency.ts`, `currency-of.ts`, `currency-store.ts` and `fmtCurrency` in `src/lib/format.ts`. Do not hardcode `$` in a new calculator.

The theme follows the system and can be set with the header toggle (`opus-theme`). All colours and sizes come from `src/styles/tokens.css`; a test fails on a raw hex, px or rem value in a component. `docs/ui-demo.html` is the approved visual reference. `node scripts/make-brand-assets.mjs` regenerates the favicon and the social image.

## Monitoring (not set up yet)

Neither error monitoring nor uptime checks exist, because both need accounts (tracker 18.4 and 18.5).

- **Uptime:** in UptimeRobot or Better Stack create three monitors: `https://opuscalculator.com/`, `https://opuscalculator.com/calculators/bmi-calculator/` and `https://opuscalculator.com/sitemap-index.xml`, each every 60 seconds from 3 regions, alerting your email after 2 consecutive failures.
- **Errors:** the plan names Sentry (`tracesSampleRate` 0.1, no session replay, source maps at build, the DSN in `SENTRY_DSN`). Add it only when `SENTRY_DSN` is set, add the Sentry host to the CSP and `KNOWN_HOSTS`, and name it in `/privacy`.
- **Incidents:** [`docs/INCIDENT_RUNBOOK.md`](docs/INCIDENT_RUNBOOK.md), [`docs/ROLLBACK.md`](docs/ROLLBACK.md) and [`docs/RUNBOOK_ONCALL.md`](docs/RUNBOOK_ONCALL.md).

## Branch protection

GitHub, Settings, Branches, Add rule for `main`: require status checks to pass (the single `check` job), require linear history, and block force pushes. Do not require approving reviews: with one maintainer you cannot approve your own pull requests. Merge with squash.

## Before launch: facts only the owner can supply

`npm run prelaunch` lists them: the governing jurisdiction in `src/config/site.ts`, a legal read-through of `/privacy`, `/terms` and `/dmca` (then `legalReviewed = true`), the three mailboxes (`hello@`, `dmca@`, `access@opuscalculator.com`), the contacts in `docs/RUNBOOK_ONCALL.md`, and the privacy page matching the real analytics and ad network.

## Release flow

`main` is never pushed to. Every change goes: branch, code and tests, `npm run verify` green locally, one commit, one push, open the PR, wait for CI (`gh pr checks --watch`), squash-merge if CI is green. Docs changes are batched into one `docs-sync-YYYY-MM-DD` PR, and that PR (no CI runs on it) and any PR that edits `.github/workflows` are merged by the owner, not by CI. CI runs on pull requests to `main` only and ignores docs paths. Never commit secrets: `claude-toggle.bat` holds an API key and is git-ignored. If your npm is configured for a private registry, `npm install` can write its URLs into `package-lock.json`; `npm run verify` fails on that, and the fix is to rewrite those URLs to `https://registry.npmjs.org/`.
