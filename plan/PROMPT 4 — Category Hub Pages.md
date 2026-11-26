Read CLAUDE.md first.

Hub pages are indexed before leaf pages and pass authority down. A thin card-grid hub will not index. Build src/pages/categories/[category].astro with:

1. 800–1,200 words of unique category analysis: what these calculations are used for, common mistakes people make, how the formulas relate to each other, and who benefits. Store this as data in src/content/categories/ (one file per category), not as lorem ipsum inline.
2. A "Most used calculators in this category" section with 2–3 unique sentences per calculator — descriptive, not just a link card.
3. A "How to choose the right calculator" decision guide (e.g. "If you are comparing loan offers, use the APR calculator; if you are sizing a mortgage, start with the mortgage calculator").
4. Links to every PUBLISHED calculator in the category, grouped into sub-clusters (e.g. Loans / Investments / Salary) rather than one flat alphabetical list.
5. CollectionPage and ItemList JSON-LD, plus breadcrumbs.
6. A hard rule: do not render the hub until it has at least 800 words. Add a build-time assertion.

Create all 14 hubs: math, finance, physics, health, conversion, everyday-life, statistics, construction, biology, sports, chemistry, food, ecology, other.