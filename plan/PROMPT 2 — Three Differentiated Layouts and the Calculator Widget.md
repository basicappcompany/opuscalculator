Read CLAUDE.md first.

Data from programmatic-SEO research is clear: a single template structure across all leaf pages causes Google to filter most of them. Build three structurally distinct layouts, assigned by category (not randomly).

Create src/components/calculator/layouts/:

LayoutA.astro — for finance and health
- Two-column on desktop: inputs left, prominent results card right
- Below the fold: "How this is calculated" accordion, a scenario comparison table, and a plain-English explanation section

LayoutB.astro — for math and physics
- Inline KaTeX rendering of the formula
- Step-by-step derivation section
- Related-calculators sidebar
- A worked example walked through numerically

LayoutC.astro — for everyday-life, conversion, construction, food, sports, other
- Compact input row, oversized result number
- A quick-reference conversion/equivalence table
- Optional visual gauge or bar

Create src/components/calculator/CalculatorWidget.tsx as a React island. It takes a config and must:
- Render default inputs AND the default computed result during SSR (no blank state, no loading spinner)
- Debounce recalculation at 150ms after hydration
- Support metric/imperial toggle where unitOptions exist
- Support a "solve for" dropdown when config.solveFor is defined
- Show inline zod validation errors with aria-describedby linking input to error
- Include Reset to defaults and Copy results buttons
- Use decimal.js exclusively for math

Create src/pages/calculators/[slug].astro that:
- uses getStaticPaths over published calculators only
- picks the layout from config.category
- renders the widget as an island with client:load
- renders formulaDescription, workedExample, FAQ accordion, related calculators, breadcrumbs, and the ad slot
- sets unique title, metaDescription, and self-referencing canonical from https://opuscalculator.com

Do not put calculator-specific logic in any layout or in the widget. Everything comes from config. Prove it by rendering bmi-calculator in LayoutA and percentage-calculator in LayoutB, and show me both pages.