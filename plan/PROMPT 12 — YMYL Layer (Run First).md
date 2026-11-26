Read CLAUDE.md first. Then append the following to CLAUDE.md under a new heading "## YMYL rules":

### YMYL rules
- Every calculator in a YMYL category (health, finance, tax, legal, construction, chemistry, food, biology) must render a category-specific disclaimer in the initial HTML, immediately below the results card and above the ad slot.
- Every YMYL page must display a visible "Last reviewed: <date>" line and, if a reviewer exists, "Reviewed by <name>, <credentials>".
- Every page must link to /about, /contact, /editorial-policy, /privacy, /terms, and /ad-disclosure in the footer.
- No YMYL page may publish without a reviewer field populated OR the editorial-policy page explicitly stating the review process for unaudited calculators.
- Every YMYL calculator's JSON-LD must include `reviewedBy` (Person) and `lastReviewed` (ISO date). If no reviewer exists, omit `reviewedBy` and set `lastReviewed` to the calculator's `lastUpdated`.
- Disclaimers must use `<aside role="note">` with class `disclaimer`, not a modal, not a tooltip, not JS-rendered.

Then implement:

STEP 1 — Create src/content/disclaimers.ts exporting a map from category to disclaimer text. Use these exact texts:
- health: "This calculator is for informational and educational purposes only. It is not a substitute for professional medical advice, diagnosis, or treatment. Always consult a qualified healthcare provider before making decisions about your health."
- finance: "This calculator is for educational and informational purposes only and does not constitute financial, investment, or tax advice. Consult a licensed financial professional before making decisions."
- tax: "This calculator provides estimates only. Tax law varies by jurisdiction and changes frequently. Consult a qualified tax professional before filing or making decisions."
- construction: "Estimates only. Verify all quantities and materials with a licensed contractor and local building codes before purchase or construction."
- chemistry: "For educational use. Follow your institution's lab safety protocols and consult a qualified chemist before any experimental use."
- food: "Estimates only. Check all ingredients against known allergies. Consult a dietitian for medical or therapeutic dietary needs."
- biology: "For educational and informational purposes only. Not a substitute for professional scientific or medical advice."
- other: "This calculator is provided for informational purposes. Verify results independently before relying on them."
- Non-YMYL categories (math, physics, conversion, everyday-life, statistics, sports, ecology) do not require a disclaimer.

STEP 2 — Create src/components/Disclaimer.astro that renders the category disclaimer in an `<aside role="note">`. Wire it into all three layouts so it appears on every YMYL page immediately below the results card and above the ad slot.

STEP 3 — Create src/content/reviewers.ts exporting a map from category to reviewer object { name, credentials, profileUrl, reviewedOn }. Seed with empty entries. The build must render the "Reviewed by" line only when a reviewer exists. Do not fabricate credentials.

STEP 4 — Create the following pages with substantial, real content (not lorem):
- /about — who runs the site, why it exists, what the site promises, and how the calculators are built and tested.
- /contact — a real email address (placeholder: hello@opuscalculator.com) and a short note about what gets a response.
- /editorial-policy — how calculators are written, tested, and reviewed; the tier system; how the quality gate works; the process for medical/financial review; how to report an error.
- /how-we-make-money — a plain-English explanation of the one-ad-per-page model and the fact that ad placement never affects the calculation.
- /accessibility — a statement of the WCAG 2.2 AA target and the reporting email.

STEP 5 — Update the base layout footer to link to all of the above. Verify every page in the site contains those links in the initial HTML.

STEP 6 — Update the JSON-LD for every calculator page to include:
"reviewedBy": { "@type": "Person", "name": "...", "hasCredential": "..." }   // only if reviewer exists
"lastReviewed": "<ISO date>"
"publisher": { "@type": "Organization", "name": "Opus Calculator", "url": "https://opuscalculator.com" }

STEP 7 — Self-audit:
- curl /calculators/bmi-calculator and confirm the health disclaimer, last-reviewed line, and footer legal links are all present in raw HTML.
- curl /calculators/mortgage-calculator and confirm the finance disclaimer is present.
- curl /calculators/percentage-calculator and confirm no disclaimer is shown (non-YMYL).
- Validate the JSON-LD on 3 YMYL pages against Google's Rich Results structure.

Report each check as PASS/FAIL with the HTML evidence.