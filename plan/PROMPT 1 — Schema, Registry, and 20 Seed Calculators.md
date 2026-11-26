Read CLAUDE.md first.

Create src/lib/types.ts defining CalculatorConfig with these fields:
- slug: string
- category: one of the 14 category slugs
- tier: 1 | 2 | 3
- publish: boolean
- title: string
- h1: string
- metaDescription: string
- intro: string (150+ words, SEO copy, answer in the first two sentences)
- inputs: array of { name, label, type: 'number' | 'select' | 'date' | 'unit', unitOptions?, min?, max?, default, validator (zod) }
- outputs: array of { name, label, format: 'currency' | 'percent' | 'number' | 'date', highlight?: boolean }
- calculate: (inputs: Record<string, unknown>) => Record<string, string>  // pure, uses decimal.js, returns formatted strings
- solveFor?: string  // name of an input the user can solve for given an output
- formulaDescription: string
- workedExample: string
- faq: array of { question, answer }
- relatedSlugs: string[]
- lastUpdated: string (ISO date)

Build src/lib/registry.ts that:
- imports every file under src/calculators/ via import.meta.glob
- dedupes by slug and throws on collision
- runs validateForIndexing() on each and logs failures as warnings (never fail the build, just exclude)
- exports getPublishableCalculators(tier?), getCalculatorBySlug(slug), getAllSlugs(), getCalculatorsByCategory(category)

Then create 20 seed calculators, one file each:

Tier 1 (publish: true):
1. mortgage-calculator (finance)
2. bmi-calculator (health)
3. percentage-calculator (math)
4. age-calculator (everyday-life)
5. compound-interest-calculator (finance)

Tier 2 (publish: false for now):
6. loan-calculator (finance)
7. calorie-calculator (health)
8. cm-to-inches (conversion)
9. concrete-calculator (construction)
10. standard-deviation-calculator (statistics)
11. tdee-calculator (health)
12. discount-calculator (finance)
13. date-difference-calculator (everyday-life)
14. tip-calculator (finance)
15. ohms-law-calculator (physics)

Tier 3 (publish: false):
16. cagr-calculator (finance)
17. body-fat-calculator (health)
18. paint-calculator (construction)
19. sample-size-calculator (statistics)
20. dog-age-calculator (other)

Every calculator must pass validateForIndexing. Write a test file per calculator using vitest asserting at least 3 known input/output pairs, including at least one decimal-precision assertion (e.g. 0.1 + 0.2 renders as 0.3, not 0.30000000000000004). Run the tests and fix failures.