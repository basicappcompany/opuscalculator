# ADR 001: Astro with static output

- **Status:** Accepted
- **Date:** 2026-11-22
- **Author:** Opus Calculator owner (drafted with Claude Code, 2026-11-23)

## Context

The site is a catalogue of calculators that will grow to roughly 3,900 pages. Almost all of each page is fixed text, a formula and a worked example; the only dynamic part is a calculator that recalculates in the browser as you type. Search engines must see the default answer in the page itself (CLAUDE.md rule 2), and every page must load fast on a phone (Lighthouse mobile performance of 90 or more).

The options were a server-rendered framework (Next.js or similar), a static-site generator, or a single-page application.

## Decision

Use **Astro with `output: 'static'`**. Pages are built once, at build time, to plain HTML files that Cloudflare Pages serves from its edge. The calculator is a single React "island" (`CalculatorWidget`) hydrated on the page; everything else ships no JavaScript. Tailwind 4 styles the site and decimal.js does the arithmetic.

## Consequences

- **Good:** the default result is in the HTML with no scripts; pages cost nothing to serve; there is no server to patch, scale or attack; the build is the test (`verify-dist` fails the build on a bad link, an unpublished URL in a sitemap or a missing footer link).
- **Good:** the JavaScript a visitor downloads is small and bounded. The build fails if the widget chunk passes 45 KB gzipped, or the widget and its code pass 66 KB (`scripts/check-bundle-size.ts`).
- **Cost:** anything that needs a server (accounts, a database, a protected dashboard) does not fit. The indexation dashboard is rendered locally for that reason (tracker 12.10), and `functions/_middleware.ts` is the one small Pages Function.
- **Cost:** a build renders every published page. At about 20 to 30 seconds for the current 19 pages it is cheap; at 3,900 pages the build time needs watching, which is one more reason to release in cohorts (ADR 003).
- **Cost:** changing a calculator means a rebuild and a deploy. That is acceptable: calculators change rarely and a deploy is one pull request.
- **Revisit when:** the site needs per-visitor server logic, or a build passes the time Cloudflare Pages allows.
