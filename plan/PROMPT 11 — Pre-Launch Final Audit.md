Read CLAUDE.md first.

Run a final audit and report each item as pass or fail with evidence:

1. Every published page returns 200 and every unpublished page returns 404.
2. No sitemap contains an unpublished URL.
3. No rendered HTML contains a link to an unpublished slug.
4. Every published page has exactly one h1, a self-referencing canonical, and valid JSON-LD (validate 10 pages against Google's Rich Results Test structure).
5. Every calculator page shows its default result in raw HTML with JavaScript disabled.
6. No page title is duplicated across the site.
7. The 14 hub pages each contain at least 800 words and link only to published calculators.
8. Lighthouse mobile performance is 90+ on 5 random pages.
9. The ad slot does not appear above the fold and does not block first interaction.
10. decimal.js is used in every calculate function — grep for raw arithmetic on currency or percentage fields and report any violations.

Produce a table of results. Do not declare the site ready until every row passes.