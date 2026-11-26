Read CLAUDE.md first. Then append to CLAUDE.md:

### Legal and operational rules
- The following pages must exist and be linked from the footer on every page: /privacy, /terms, /ad-disclosure, /accessibility, /dmca. Without these, the site is not deployable.
- Privacy must disclose Plausible/Umami analytics (no cookies, no PII), ad network cookies, and the search terms that may be logged by the host. It must link to the analytics provider's data policy and to the ad network's opt-out page.
- Terms must include a limitation of liability and a governing jurisdiction (fill in your jurisdiction at deploy time).
- Ad Disclosure must state plainly that the site is funded by ads, that ad placement never influences the calculation, and that calculators are free and complete without interaction with any ad.
- /dmca must include a designated contact email and a takedown process.
- Every ADR (Architecture Decision Record) in docs/adr/ must be dated, signed by the author, and never edited after merge (superseded ADRs are marked, not deleted).
- The incident runbook must cover: site down, deindexing (traffic drop > 30% in 7 days), ad account suspension, and a security breach.

Then implement:

STEP 1 — Create the following legal pages with real content (not lorem, not placeholder disclaimers):
- /privacy: data collected (analytics events, no cookies from Plausible by default), ad network cookies (AdSense: NID, ANID; document what each does and how to opt out at google.com/settings/ads), log retention, CCPA/GDPR rights (access, deletion, portability), contact email.
- /terms: acceptable use, IP, disclaimer of warranties, limitation of liability, governing law, changes to terms, contact.
- /ad-disclosure: plain-language. "We pay for hosting and development with ads. Ads are always below the calculator. You can use every calculator without clicking any ad. Ad placement is never influenced by the calculation."
- /dmca: designated agent email (dmca@opuscalculator.com), process for submitting a notice, process for counter-notice.
- /accessibility: target is WCAG 2.2 AA, known limitations (list any), reporting email (access@opuscalculator.com), commitment to respond within 10 business days.

STEP 2 — Wire all five into the footer of every page. Verify with curl that /privacy, /terms, /ad-disclosure, /accessibility, and /dmca all return 200 and are linked from at least 3 pages.

STEP 3 — Create docs/adr/ with three initial ADRs:
- 001-astro-static-output.md: why Astro over Next.js (static output, zero JS default, 10k-page builds), consequences, decision date.
- 002-no-database.md: why calculators are TS config files (build-time generation, zero runtime cost, no DB migration path until accounts are added), consequences.
- 003-cohort-gated-rollout.md: why 3,800 pages cannot ship in one build (index bloat, Google's scaled-content-abuse policy, indexation rate data), the 40%/20% gate, consequences.

Each ADR follows the standard format: Status, Context, Decision, Consequences, Date, Author. Commit them.

STEP 4 — Create docs/INCIDENT_RUNBOOK.md covering:
- Site down (>2 consecutive uptime failures): check Cloudflare status, check last deploy, rollback via Cloudflare Pages → Deployments → previous deploy.
- Traffic drop >30% in 7 days (suspected deindexing): export GSC coverage report, check manual actions, run scripts/check-indexation.ts, compare cohort indexation rates, check robots.txt, check for accidental noindex, compare sitemap URL counts.
- Ad account suspension: remove ad script within 1 hour, file appeal, document root cause, do not redeploy ads until the appeal is resolved.
- Security breach (unauthorized commit, exposed secret): rotate every secret, invalidate Cloudflare Access tokens, review git log, notify affected parties within 72 hours if PII was exposed.
- Each scenario includes: detection, first 15 minutes, first hour, communication, root-cause writeup.

STEP 5 — Create docs/ROLLBACK.md with the exact steps to roll back a deploy on Cloudflare Pages, to roll back a cohort (set env flag to false, rebuild, and set affected pages to noindex), and to roll back a Cloudflare Access policy change.

STEP 6 — Create docs/RUNBOOK_ONCALL.md (one-pager): who to call, in what order, at what hour threshold, with contact placeholders.

STEP 7 — Self-audit:
- curl -I https://<staging>/privacy, /terms, /ad-disclosure, /accessibility, /dmca and confirm 200.
- Grep the built output for "Privacy" and "Terms" in the footer and confirm they appear on every page.
- Confirm the 3 ADRs exist and follow the format.
- Confirm the runbook covers all 4 incident types.
- Confirm the rollback doc has been tested: perform a rollback of the current deploy to the previous one and back, and confirm both are clean.

Report each as PASS/FAIL with evidence.