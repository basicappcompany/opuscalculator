Read CLAUDE.md first.

1. Sitemaps: partition by cohort and category. sitemap-index.xml points to sitemap-tier1.xml, sitemap-tier2-finance.xml, sitemap-tier2-health.xml, etc. Include ONLY published URLs. Base URL https://opuscalculator.com. Max 50,000 URLs per file.
2. robots.txt: allow Googlebot, Bingbot, GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot. Do not block CSS or JavaScript. Disallow query-parameter facets (?sort=, ?filter=, ?page=).
3. Rendering: Astro static output. All Cohort 1 pages and all 14 hubs pre-rendered at build. Cohort 2 and 3 excluded from getStaticPaths until their flag is promoted.
4. Canonicals are self-referencing everywhere. A paginated page canonicalizes to itself, not to page 1.
5. Do not use Google's Indexing API. Discovery is sitemaps plus internal links only.
6. Add a build step that fails loudly if any sitemap contains an unpublished URL or a duplicate URL.

Run the build and report: total pages generated, build time, and the list of sitemap files created.