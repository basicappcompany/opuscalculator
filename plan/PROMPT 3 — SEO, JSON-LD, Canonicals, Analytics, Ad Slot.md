Read CLAUDE.md first.

For every calculator page:
1. Unique title and meta description generated from config (not duplicated across pages — add a build-time check that no two titles are identical).
2. Self-referencing canonical using https://opuscalculator.com.
3. JSON-LD in a script tag: WebApplication (name, description, applicationCategory, offers with price 0) + FAQPage from config.faq + BreadcrumbList.
4. Exactly one h1. Semantic main / article / section structure.
5. noindex meta on any page where publish === false. Additionally, getStaticPaths must exclude unpublished pages so they 404 rather than render.
6. Open Graph and Twitter card meta tags per page.
7. An ad slot component: exactly one unit, placed after the calculator content, using loading="lazy" and deferred loading so it never blocks first interaction. Nothing above the fold.
8. Install and configure Plausible (or Umami) with a single script tag in the base layout. No cookie banner.

Then self-audit: curl the raw HTML of /calculators/bmi-calculator and confirm that the h1, canonical, JSON-LD, default input values, and the default computed result are ALL present without executing JavaScript. Paste the relevant HTML excerpt.