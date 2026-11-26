## What and why

<!-- One or two sentences. Link the tracker item or plan prompt. -->

## Checklist

- [ ] `npm run verify` is green locally (lockfile guard, type check, tests, build) and I ran it again after my last change
- [ ] Calculator passes `validateForIndexing` (the build lists any that do not)
- [ ] Unit tests added for any new formula (at least 3 known answers; money and percentages use decimal.js)
- [ ] `npm run a11y` passes locally (zero axe violations)
- [ ] No new `npm audit --audit-level=high` findings
- [ ] If YMYL (health, finance, construction, chemistry, food, biology): disclaimer rendered, last-reviewed set, reviewer considered
- [ ] If a new calculator: appears in the correct hub, internal links added, no link to an unpublished page
- [ ] No secret, key or token is committed, and `claude-toggle.bat` is not staged
- [ ] If `package.json` changed: `git diff package-lock.json` shows no private-registry URLs

## Notes for the reviewer

<!-- Anything unusual: a deviation from the plan, a risk, something not tested. -->
