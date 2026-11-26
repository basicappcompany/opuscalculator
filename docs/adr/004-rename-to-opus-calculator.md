# ADR 004: Rename the project to Opus Calculator

- **Status:** Accepted
- **Date:** 2026-11-26
- **Author:** owner (drafted with Claude Code, 2026-11-26)

## Context

The project was named calculator365 and planned for calculator365.net. Its brand rested on the "365" pun, "a calculator for every day of the year". The owner has since bought the domain opuscalculator.com and decided to rename the project Opus Calculator. Nothing is deployed and no cohort is live, so no visitor, link or search result depends on the old name.

## Decision

- The project is **Opus Calculator**, at **https://opuscalculator.com** (no `www`). That address is the canonical URL in canonical tags, sitemaps, JSON-LD, `robots.txt`, the CSP and the audit scripts. The brand is written "Opus Calculator" in titles, the header, structured data and the legal pages.
- The "365" mark, the tagline "a calculator for every day of the year" and the 404 heading "That page isn't on the calendar" are retired. The mark is now an "O"; the plain tagline is "Free calculators for everyday questions".
- Browser storage keys changed from `c365-theme`, `c365-currency` and `c365-currency-detected` to `opus-theme`, `opus-currency` and `opus-currency-detected`, and the in-page events and globals from `c365` to `opus`. Because nothing is live, no visitor loses a saved preference.
- The three mailboxes become hello@, dmca@ and access@ opuscalculator.com. They must exist before launch (tracker item 19.8).

## Consequences

- **Good:** the name, the domain and the site agree, and the brand no longer depends on a pun that the new name cannot carry.
- **Applied everywhere:** at the owner's request the new name and domain were also written into the plan files, ADRs 001 to 003 (author lines only), the status page, the accessibility audit table and the runbooks, so no document names the old project.
- **Not changed, and why:** the GitHub repository URL (`basicappcompany/calculator365`) and the Cloudflare Pages project name are the owner's accounts, so they keep their old names until the owner renames them; the folder name on the owner's disk is also unchanged.
- **Owner actions:** rename the GitHub repository and update the `origin` remote; create the Cloudflare Pages project (or rename it) and add the domain opuscalculator.com; create the three mailboxes; set `PLAUSIBLE_DOMAIN=opuscalculator.com` where analytics is configured; add opuscalculator.com as the Search Console property. Whether calculator365.net, if the owner also owns it, should redirect to the new domain is the owner's decision.
- **Cost:** the visual baselines include the header, so they were re-recorded; the Open Graph image and favicon were regenerated from `scripts/make-brand-assets.mjs`.
