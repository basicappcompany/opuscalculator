Read CLAUDE.md first. Then append to CLAUDE.md:

### Design rules
- One source of truth for design tokens at src/styles/tokens.css. No hardcoded hex, px, or rem values in component files — always use CSS custom properties.
- Dark mode via `prefers-color-scheme` and a manual override stored in localStorage key `c365-theme`. Default: system.
- Every calculator widget must implement empty, loading, and error states — not just the happy path. The empty state shows default inputs and the default result. The loading state is never visible during SSR. The error state appears only when validateForIndexing rejects a specific input combination at runtime.
- 404 and 500 pages must exist and must be linked from robots.txt's `Sitemap:` directive section only — they must not appear in any sitemap.
- Bundle budget: calculator widget must stay under 45 KB gzipped. Build fails if exceeded.

Then implement:

STEP 1 — Create src/styles/tokens.css defining:
- Colors: --color-bg, --color-fg, --color-muted, --color-accent, --color-accent-fg, --color-danger, --color-success, --color-border, --color-card. Define both light and dark values.
- Type scale: --text-xs (0.75rem) through --text-4xl (2.25rem), 6 steps.
- Spacing: --space-1 (0.25rem) through --space-16 (4rem), 8 steps.
- Radii: --radius-sm (4px), --radius-md (8px), --radius-lg (16px), --radius-full.
- Shadows: --shadow-sm, --shadow-md, --shadow-lg.
- Font families: --font-sans (system stack), --font-mono (for result numbers).

STEP 2 — Refactor all three layouts and the CalculatorWidget to consume only these tokens. Grep for `#` and `px` in component files and report any remaining hardcoded values.

STEP 3 — Implement dark mode:
- A theme toggle button in the header, accessible via keyboard, with `aria-pressed` state.
- On load, read localStorage `c365-theme`; if absent, follow `prefers-color-scheme`.
- Write the preference back to localStorage on toggle.
- No flash of incorrect theme (set the class in an inline script in `<head>` before CSS loads).

STEP 4 — Implement widget states in CalculatorWidget.tsx:
- Empty/default: shows defaults and the computed default result (already required by rule 2).
- Error: when an input fails zod at runtime, show an inline error and preserve the last valid result with a "stale" visual indicator.
- Disabled: when `solveFor` is selected but the target output is not yet computable, disable the disabled field with `aria-disabled` and a tooltip explaining why.

STEP 5 — Create src/pages/404.astro and src/pages/500.astro with:
- Friendly copy, a link to /all-calculators, and a link to the search bar.
- 404 must return HTTP 404 status (verify with curl -I).
- 500 must return HTTP 500 status when served as a static fallback — note this in a comment.

STEP 6 — Add a bundle-size check to the build: install `rollup-plugin-visualizer` (or use Astro's built-in bundle analysis), measure the calculator island, and fail the build if it exceeds 45 KB gzipped. Document the current size in README.md.

STEP 7 — Favicon and OG assets: generate a simple text-based favicon from the "O" mark (SVG acceptable), an OG image template at /public/og-template.png (1200x630, placeholder text is fine), and wire it into every page's `og:image`.

Self-audit: report token usage (grep for `#` in src/components), bundle size, and confirm 404 returns 404 and OG tags are present on 3 random pages.