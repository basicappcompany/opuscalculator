Read CLAUDE.md first. Then append to CLAUDE.md:

### CI/CD rules
- Nothing merges to main without passing: lint, typecheck, unit tests, build, a11y (axe-core, zero violations), link-audit (zero orphans), and npm audit (no high/critical).
- Every PR gets a Cloudflare Pages preview deploy with its own URL. The URL is posted as a PR comment.
- Branch protection on main: require 1 approving review, require status checks, require linear history, disallow force push.
- Commit messages follow Conventional Commits (feat:, fix:, chore:, docs:, refactor:, test:).
- Every dependency upgrade PR (Dependabot) must be reviewed within 5 business days.

Then implement:

STEP 1 — Create .github/workflows/ci.yml with these jobs:
- lint: ESLint + Prettier check
- typecheck: `astro check` or `tsc --noEmit`
- test: vitest
- build: `npm run build`
- a11y: `npm run a11y` against the built site (spawn `astro preview` in the background)
- link-audit: `npx tsx scripts/link-audit.ts` against the built site
- audit: `npm audit --audit-level=high`

All jobs must run on pull_request and on push to main. Use Node 20 with cache: 'npm'.

STEP 2 — Create .github/workflows/preview.yml that deploys to Cloudflare Pages on every PR and posts the preview URL as a PR comment using the `marocchino/sticky-pull-request-comment` action.

STEP 3 — Configure ESLint (flat config with `@typescript-eslint`) and Prettier. Add pre-commit hooks via husky + lint-staged:
- On staged *.ts, *.tsx, *.astro: run eslint --fix and prettier --write.
- On staged *.md: run prettier --write.

STEP 4 — Create .github/dependabot.yml with weekly schedule for npm and github-actions.

STEP 5 — Document branch protection setup in README.md (GitHub → Settings → Branches). Include a screenshot placeholder.

STEP 6 — Create .github/PULL_REQUEST_TEMPLATE.md with a checklist:
- [ ] Calculator passes validateForIndexing
- [ ] Unit tests added for new formula
- [ ] a11y check passes locally
- [ ] No new npm audit vulnerabilities
- [ ] If YMYL: disclaimer rendered, last-reviewed set, reviewer considered
- [ ] If new calculator: appears in correct hub, internal links added

STEP 7 — Self-audit:
- Run `npm run lint && npm run typecheck && npm test && npm run build && npm run a11y && npx tsx scripts/link-audit.ts && npm audit --audit-level=high` locally and confirm all pass.
- Push a trivial commit to a test branch and confirm the CI workflow passes.
- Open a test PR and confirm the preview URL is posted.

Report each as PASS/FAIL with the CI run URL.