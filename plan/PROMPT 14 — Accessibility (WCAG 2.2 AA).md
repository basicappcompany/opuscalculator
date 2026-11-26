Read CLAUDE.md first. Then append to CLAUDE.md:

### Accessibility rules
- WCAG 2.2 AA is the target. Every calculator page must pass axe-core with zero violations of any severity.
- Every interactive element must be reachable by Tab, activatable by Enter/Space, and dismissible by Escape.
- Every form input has a programmatically associated `<label>`. Every error is linked to its input via aria-describedby. Every required field is marked aria-required.
- Color contrast is at least 4.5:1 for text and 3:1 for UI components and focus rings.
- Focus is always visible and never trapped. The theme toggle, the reset button, the copy-results button, and the solve-for dropdown must each show a visible focus ring.
- The page must be fully operable at 200% zoom and at 320px viewport width without horizontal scroll.

Then implement:

STEP 1 — Audit all three layouts, the CalculatorWidget, the Disclaimer, the ad slot, and the footer with axe-core (run `npx @axe-core/cli` against a local build for each of the 5 seed pages). Report every violation. Fix every violation.

STEP 2 — Keyboard audit: for each of the 5 seed calculators, tab through the entire page and record the tab order in a markdown table. Confirm:
- Skip-to-content link is the first tab stop.
- All inputs, selects, buttons, and the theme toggle are reachable.
- The solve-for dropdown is reachable and its options are navigable with arrow keys.
- No element traps focus.
- The ad slot does not steal focus.

STEP 3 — Add a "Skip to calculator" link as the first focusable element on every page. Style it visibly only when focused.

STEP 4 — Ensure the result number announces changes to screen readers: wrap it in `<output aria-live="polite" aria-atomic="true">`. Debounce announcements so they do not fire on every keystroke — fire only when the value stabilizes for 400ms.

STEP 5 — Install `@axe-core/cli` and `pa11y` as dev dependencies. Add a script `npm run a11y` that runs axe-core against 5 representative pages from the local build. It must exit non-zero on any violation.

STEP 6 — Install `@axe-core/playwright` for the E2E test suite that Prompt 17 will add. Do not run it yet — just install and configure.

STEP 7 — Self-audit:
- Run `npm run a11y` against 5 pages. Report zero violations.
- Zoom the site to 200% and confirm no horizontal scroll on the calculator pages (describe how you tested).
- Confirm the tab order table for bmi-calculator and mortgage-calculator.
- Confirm the `aria-live` announcement works (describe the test method).

Report each as PASS/FAIL.