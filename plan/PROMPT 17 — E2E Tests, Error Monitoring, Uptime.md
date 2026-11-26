Read CLAUDE.md first. Then append to CLAUDE.md:

### Observability rules
- Every calculator has at least one Playwright E2E test that types inputs, waits for the debounced result, and asserts the exact rendered number.
- Visual regression tests cover each of the three layouts on 3 representative pages. A layout change that breaks any of the 9 screenshots fails CI.
- Sentry is installed on the client bundle with `tracesSampleRate: 0.1` and `replaysSessionSampleRate: 0.0`. No session replay is captured (privacy).
- Uptime monitoring pings the homepage every 60 seconds from 3 regions. Any 5xx for 2 consecutive checks triggers an alert.
- Core Web Vitals are tracked in Sentry from real users. LCP regressions of > 10% week-over-week trigger a review.

Then implement:

STEP 1 — Install Playwright (`npm i -D @playwright/test`). Create playwright.config.ts with projects for chromium, firefox, webkit, and mobile-safari (4 projects). Base URL is the preview deploy.

STEP 2 — Create tests/e2e/ with one spec per seed calculator (5 specs minimum):
- bmi-calculator.spec.ts: enter metric values, assert BMI number, toggle to imperial, assert equivalent, reset, assert defaults.
- mortgage-calculator.spec.ts: enter principal/rate/term, assert monthly payment to the cent (this catches precision regressions).
- percentage-calculator.spec.ts: assert solve-for switching works.
- age-calculator.spec.ts: assert date input and years/months/days output.
- compound-interest-calculator.spec.ts: assert final balance.

Each spec must also include an `@axe-core/playwright` scan and fail on any violation.

STEP 3 — Visual regression: create tests/visual/ with screenshots of bmi-calculator (LayoutA), percentage-calculator (LayoutB), and tip-calculator (LayoutC), each in light and dark mode, at desktop and mobile viewports (2 × 2 × 3 = 12 snapshots total). Use Playwright's built-in `toHaveScreenshot`. Baseline snapshots are committed.

STEP 4 — Install Sentry (`npm i @sentry/astro @sentry/browser`). Configure:
- DSN from env var SENTRY_DSN (client) and SENTRY_AUTH_TOKEN (build).
- tracesSampleRate: 0.1
- No session replay.
- Source maps uploaded at build.
- Create a Sentry project and document the setup steps in README.md.

STEP 5 — Uptime monitoring: document the UptimeRobot or Better Stack setup in README.md. Targets:
- https://opuscalculator.com/ (60s interval, 3 regions)
- https://opuscalculator.com/calculators/bmi-calculator (60s)
- https://opuscalculator.com/sitemap-index.xml (60s)

Alert channel: email. Threshold: 2 consecutive failures.

STEP 6 — Add a "Core Web Vitals" section to /admin/indexation that reads Sentry's RUM data via the API (or a simpler Plausible custom event) and reports weekly p75 LCP, INP, and CLS.

STEP 7 — Add `npm run e2e` and `npm run visual` scripts. Wire both into CI (Prompt 16's workflow) as a separate job that runs after the preview deploy.

STEP 8 — Self-audit:
- Run the full E2E suite against the preview URL. Report pass/fail per spec.
- Run the visual suite. Report whether baselines are committed and whether re-running produces zero diffs.
- Trigger a Sentry error manually (a `throw new Error('test')` in a dev-only route) and confirm it appears in Sentry within 60 seconds.
- Confirm the uptime monitors are green.

Report each as PASS/FAIL with evidence (Sentry event URL, Playwright report path).