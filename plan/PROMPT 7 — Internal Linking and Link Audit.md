Read CLAUDE.md first.

Every published calculator page must link to:
- its parent category hub
- at least 3 sibling calculators in the same sub-cluster
- at least 2 cross-category calculators that share inputs (e.g. BMI links to BMR and body fat, but also to calorie deficit)
- the relevant Tier 1 calculator for its category

Never link to an unpublished page from anywhere. Add a build-time check that fails if a rendered page contains an href to an unpublished slug.

Breadcrumb JSON-LD on every page.

Create scripts/link-audit.ts that crawls the built site and reports:
- orphan pages (zero inbound internal links)
- pages with fewer than 3 inbound internal links
- pages reachable only from a sitemap, not from any HTML link
- any link to an unpublished slug

Run the audit and paste the output. Fix every orphan before we promote any cohort.