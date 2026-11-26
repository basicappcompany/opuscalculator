# ADR 003: Cohort-gated rollout

- **Status:** Accepted
- **Date:** 2026-11-22
- **Author:** Opus Calculator owner (drafted with Claude Code, 2026-11-23)

## Context

The plan is about 3,900 calculators. Publishing them all in one build would put thousands of near-similar pages in front of search engines at once, a pattern that risks being treated as scaled content abuse under Google's spam policies, wastes crawl budget on pages that have not earned a place, and leaves no way to learn which kinds of page are actually indexed and read before more are added. The site has no history yet, so there is no indexation data to lean on.

## Decision

Release in **cohorts**. A page is live when its calculator says `publish: true` and the flag for its tier's cohort is on (`COHORT_1_PUBLISHED`, `COHORT_2_PUBLISHED`, `COHORT_3_PUBLISHED`; cohort N is tier N, a working assumption recorded as tracker item 12.4). Unpublished pages return 404 and appear in no sitemap, hub or link.

A later cohort may be switched on only when the earlier one has proved itself: **more than 40% of cohort 1 pages indexed and at least 20% of them with organic clicks** (the same test for cohort 3 against cohort 2). The rule is enforced in code, not by memory: `src/config/rollout.ts` throws, and so fails the build, if a cohort 2 or 3 flag is on without a fresh `src/config/promotion-gate.json`, which `npm run gate` writes from a real `indexation.csv` that is at most 14 days old. A cohort that falls below 30% indexation is demoted.

## Consequences

- **Good:** the site grows only as fast as search engines and readers accept it, and each step produces data (`npm run indexation`) that the next step depends on.
- **Good:** quality is held by the same mechanism: the quality gate keeps weak pages out, and the cohort gate keeps pages out until the earlier ones have done well.
- **Good:** deleting is safe. Pages that earn nothing are pruned to noindex (`npm run prune`), and a deleted page answers 410 through the Pages Function.
- **Cost:** most of the catalogue is built and tested but not live for months. That is the point, but it means launch traffic comes from a small set of pages (five calculators and four hubs at the time of writing).
- **Cost:** hubs for categories with nothing published do not render (open question 12.6), and the plan's link rules cannot be fully met by a five-page launch (12.5).
- **Cost:** the promotion needs weekly Search Console data, which needs a verified property and a service account (tracker 8.7).
- **Rolling back:** set the cohort's flag to false, rebuild, and set the affected pages to noindex. See `docs/ROLLBACK.md`.
