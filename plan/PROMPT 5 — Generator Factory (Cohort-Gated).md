Read CLAUDE.md first.

Do NOT publish thousands of pages yet. Build generators that can produce them, gated by src/config/rollout.ts which reads env vars COHORT_1_PUBLISHED, COHORT_2_PUBLISHED, COHORT_3_PUBLISHED (default: only COHORT_1_PUBLISHED is true).

Create these generators in src/generators/:

- units.ts — every pairwise conversion across length, weight, volume, temperature, area, speed, time, digital storage, pressure, energy. Each pair is its own slug (cm-to-inches, kg-to-pounds, celsius-to-fahrenheit). Each gets unique SEO copy and formulaDescription.
- finance.ts — loan and mortgage variants by country (US, UK, CA, AU, IN) and term; investment calculators; salary and tax calculators; business calculators (break-even, margin, markup, discount, tip, VAT).
- health.ts — body metrics, pregnancy and fertility, nutrition, fitness.
- math.ts — geometry (every shape's area and perimeter), triangle solvers (SSS, SAS, ASA, AAS, SSA, right, isosceles, equilateral), fraction operations, percentage variants, logs and exponents, statistics, number theory.
- physics.ts — kinematics, forces, energy and work, electricity, waves.
- everyday.ts — dates and time, money and tips, randomizers.
- emerging.ts — LLM token cost, crypto, localized tax, parenting, pets, gaming, real estate, automotive, education.

Rules for every generator:
- Every generated config MUST pass validateForIndexing.
- If a generated intro fails the uniqueness check, the generator must either produce a differentiated intro or emit publish: false. It must never silently publish a near-duplicate.
- Use template strings with variable interpolation so copy is not verbatim across pages.
- Assign tier and cohort per the mapping in the build spec.

Create scripts/count-calculators.ts that prints total calculators per category, per cohort, and the number that failed the quality gate with reasons. Run it and report the output.