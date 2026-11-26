Read CLAUDE.md first.

1. Create scripts/check-indexation.ts that reads the published sitemaps, queries the Search Console URL Inspection API for each URL, and writes indexation.csv with columns: url, cohort, coverage_state, last_crawl_date. Run it weekly.
2. Create a protected page at /admin/indexation that reads that CSV and renders: total published, total indexed, indexation rate by cohort, and a list of pages in "Crawled — currently not indexed".
3. Pruning rule: any page with zero impressions and zero clicks for 90 consecutive days gets noindex (still crawlable, still linked, not deleted). Deletions use 410 Gone, never 404.
4. Promotion gate, enforced in code and documented in CLAUDE.md: COHORT_2_PUBLISHED may only be set true when Cohort 1 indexation rate > 40% AND at least 20% of Cohort 1 pages have recorded organic clicks. Same rule for Cohort 3 relative to Cohort 2.

Run a dry run of the scripts against a mock CSV and show me the dashboard.