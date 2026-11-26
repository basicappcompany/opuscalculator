Read CLAUDE.md first.

1. Formula tests: every calculator has at least 3 known input/output assertions. Run the full suite and report pass/fail. Fix all failures. Pay specific attention to decimal precision — mortgage totals must match a reference amortization schedule to the cent.
2. Run the full build. Fix every TypeScript error. Report: total pages, build time, calculators passing the quality gate, calculators failing and why.
3. Run a Lighthouse audit on 5 random calculator pages (3 mobile, 2 desktop). Fix anything below 90 on mobile performance.
4. Deploy to Cloudflare Pages. Give me the exact build command, output directory, and environment variables (COHORT_1_PUBLISHED, COHORT_2_PUBLISHED, COHORT_3_PUBLISHED, SITE_URL=https://opuscalculator.com).
5. After deploy, curl 20 random calculator URLs and confirm each returns HTTP 200 and contains the correct h1, canonical, JSON-LD, and default computed result in the raw HTML.
6. Write README.md covering: how to add a single calculator, how to add a generator, how to promote a cohort, how to run the indexation check, and how to run the link audit.