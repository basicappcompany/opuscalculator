---
name: docs-sync
description: Sync Opus Calculator's status page and docs with what has actually been built and measured. Use when the user says "docs-sync", "/docs-sync", "update the status page", "sync the docs", or at the end of a work session. Re-measures every quoted number and removes stale values.
---

# docs-sync for Opus Calculator

Bring `docs/status.html`, `CLAUDE.md` and `README.md` in line with reality. Never write a claim you have not verified in this session or in the repo. A value that was not measured is written "Not measured", never carried over from an older version of the page.

The source of truth for what the project must do is `plan/` (Prompts 0 to 11 and Appendices A to C). The status page tracks that plan; it does not replace it.

## 1. Work out what changed

- `git status` and `git log --oneline` since the last commit whose message starts with "Docs". If the repo has no commits yet, say so and use `git status` plus the file tree.
- Compare the file tree to Appendix C (the file map) and to each prompt's deliverables, to see which `PHASES` items now exist.
- If a remote and pull requests exist, check merged and open PRs too (`gh pr list`). If not, skip this; do not guess.
- Things done outside the repo (domain, Cloudflare, Search Console, analytics account, directory submissions) come from the conversation only, never from assumption.
- New problems, decisions waiting on the user, and newly found gaps in the plan.

## 2. Re-measure what the docs quote

Do not copy numbers from the old page. Read them again from the source. If the tool or script does not exist yet, the value stays "Not measured" or "Not run".

| Quoted value                                                     | Source                                                                                                                     |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Calculators per category, per cohort, gate failures with reasons | `npx tsx scripts/count-calculators.ts` (item 5.10)                                                                         |
| Seed calculator state (planned / built / published)              | `src/calculators/*.ts` exists and passes its test = built; `publish: true` AND live URL answers 200 = published            |
| Unit test counts                                                 | `npx vitest run`; quote the real pass and fail counts and file count                                                       |
| Build, page count, build time, sitemap files                     | `npm run build`, then count pages and sitemap URLs in `dist/`                                                              |
| Sitemap and link integrity                                       | the build-time sitemap check (6.6), `scripts/link-audit.ts` (7.4)                                                          |
| Indexation rate per cohort, clicks per cohort                    | `indexation.csv` from `scripts/check-indexation.ts`, with its file date. Never estimate.                                   |
| Lighthouse                                                       | only if run this session; say mobile or desktop, which URL, which Lighthouse version                                       |
| Live checks                                                      | `curl -sI https://opuscalculator.com/...` for status codes, redirects and headers; raw-HTML checks per Prompts 3, 9 and 11 |
| Cohort flags                                                     | the real values in `src/config/rollout.ts` and in the Cloudflare Pages env (ask the user for the latter, do not assume)    |
| Dependency versions                                              | `package.json`, never from memory                                                                                          |

Set a scorecard entry's `asOf` to today only when it was measured today. Leave `asOf` off when the value is "Not measured".

## 3. Update, in this order

1. `docs/status.html`, data arrays near the bottom of the file:
   - `PHASES`: set each item's `state` (`done | progress | todo | waiting | later`) and `owner` (`me | you | both | none | external`). Done items need `when` and owner `none`. `waiting` items need `blockedBy`. Open items owned by `you` or `both` need numbered `steps`. Add new items instead of stretching old ones. Item ids are `phase.number` and are never reused.
   - Close a Phase 12 open question only when the user has answered it: record the answer in `DECISIONS`, mark the item done with `when`, and apply the answer to every item that referred to it (their `blockedBy` and notes).
   - `TOOLS_DATA`: move a row `planned` to `built` to `published` in the same change that moves the page. `published` needs `publish: true` and a live 200.
   - `GATES` ("Today" column), `ENV_VARS`, `DECISIONS`, `TIMELINE` (newest entry last), `SCORECARD`.
   - `VERIFIED_ON` (ISO date, today) and the `VERIFIED` text: what was measured and how, and what was NOT checked.
2. `CLAUDE.md`: stack, versions, conventions, commands and milestones, only where they changed. It must still contain the Prompt 0 block verbatim; do not paraphrase the non-negotiable rules. Record the promotion gate there (item 8.5) once it is enforced in code.
3. `README.md`: only if setup, dev, test, deploy, cohort promotion, the indexation check or the link audit changed (item 9.5 lists the five topics it must cover).
4. `docs/DISTRIBUTION.md`: only the rows that changed. Record each rule with the date it was read.
5. Sweep stale values: `grep -rn` for old counts (calculators, pages, tests, hubs), "planned", "coming soon", "not yet", old versions and old URLs across `README.md CLAUDE.md docs src scripts public`. Anything that now disagrees gets fixed, unasked.

## 4. Verify

- The project's own checks pass: type check, `npx vitest run`, `npm run build` (skip, and say so, any that do not exist yet).
- Open `docs/status.html` in a browser, light and dark, phone width and desktop:
  - the footer says "Data check OK" (it validates unique ids, states, owners, `when`, `blockedBy`, `steps` and page statuses; fix every problem it lists in the console);
  - the stale banner is absent (it appears when `VERIFIED_ON` is 3 or more days old);
  - the "Pending from you" and "What I can do" counts equal their cards and the matching filter chip counts;
  - the page table's three counts add up to the number of rows in `TOOLS_DATA`;
  - no scorecard value carries a stale tag, and no console errors or horizontal overflow.
- Phase item counts: 13 phases today; if phases were added, the intro text and `plan/` mapping still agree.

## 5. Ship it

- Release flow is recorded in `CLAUDE.md` (RELEASE FLOW) and was decided on 22 Nov: pull requests only, never push to `main`, merge only when the user says so.
- New branch `docs-sync-YYYY-MM-DD`, commit, push, open a PR with `gh pr create`, then wait for the user to merge. Do not commit or push unless the user asked for a sync or a ship.
- CI minutes are scarce (strict rule in `CLAUDE.md`). Docs-sync changes are docs-only: batch them into ONE commit and ONE push per PR, run the local checks first, and never push to see whether CI passes. If a workflow exists, confirm it ignores docs-only paths; if it does not, say so in the report instead of pushing.
- Before committing, `git status` and check the diff for secrets. `claude-toggle.bat` holds an API key and is git-ignored; never add it, and never print its contents.
- The status page is one self-contained file with no external requests so it opens straight from disk. Keep it that way: no CDN scripts, fonts or images.
- Commit and PR bodies end with the attribution lines the harness gives for the session.

## 6. Report

List what changed in the docs, the verified numbers, and what is still waiting on the user, split into "needs you" and "I can do". Say plainly what was not checked. Update project memory only with facts that matter to later sessions.

## Boundaries

- Do not mark an item done on the user's word alone if it can be checked (a URL, a deploy, a file, a test run); check it. If it cannot be checked (a Product Hunt submission, a Reddit post, a dashboard setting), record that the user said so and leave the evidence line honest.
- Never write indexation, click, ranking, Lighthouse or traffic numbers that were not measured. No `indexation.csv` means "Not measured".
- Never mark a cohort promotable or promoted unless the gate in Appendix B is met by measured data and the user has flipped the flag.
- Do not enter passwords, keys or tokens anywhere (`SEARCH_CONSOLE_CREDENTIALS` stays out of the repo and the client bundle), and do not change DNS or security settings: list them as owner steps.
- Never use or suggest Google's Indexing API (rule 8).
