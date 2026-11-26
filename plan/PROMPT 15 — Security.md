Read CLAUDE.md first. Then append to CLAUDE.md:

### Security rules
- Every response must include: HSTS (max-age 63072000; includeSubDomains; preload), X-Content-Type-Options (nosniff), Referrer-Policy (strict-origin-when-cross-origin), Permissions-Policy (camera=(), microphone=(), geolocation=()), X-Frame-Options (DENY), and a Content-Security-Policy that allows only the third parties explicitly in use.
- The /admin/indexation route must be protected by Cloudflare Access. It must not be reachable without authentication.
- No secret may appear in the client bundle. Any environment variable prefixed `PUBLIC_` is client-visible — audit for leaks.
- `npm audit` must be run in CI and fail on any high or critical severity vulnerability.
- Third-party scripts (Plausible, ad network) must be loaded with `integrity` where the provider supports SRI, or with strict CSP host allowlisting.
- Every input rendered by the calculator must be sanitized at the boundary of `calculate()`. zod validators are mandatory for every input.

Then implement:

STEP 1 — Create public/_headers (Cloudflare Pages uses this file for response headers) with:
/*
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
X-Frame-Options: DENY
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://plausible.io https://pagead2.googlesyndication.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://plausible.io; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
Adjust the CSP host allowlist to match exactly the scripts actually loaded (Plausible, ad network). Remove any host not in use.

STEP 2 — Configure Cloudflare Access for /admin/* via a `public/_headers` exception or a Cloudflare dashboard rule (document the dashboard steps in README.md). The middleware must return 401 if the request has no Cloudflare Access JWT. Verify by curling the route without a token and confirming 401.

STEP 3 — Audit for secret leaks:
- List every environment variable in .env.example.
- Grep the built output (`dist/`) for every value of every variable that is not prefixed PUBLIC_.
- Confirm no service-account JSON, API key, or token appears in the client bundle.
- If a leak is found, rotate the secret, not just remove the variable.

STEP 4 — Add SRI to Plausible: use the versioned URL with `integrity` attribute if Plausible supports it (check their docs). If not, document why and rely on CSP host allowlisting instead.

STEP 5 — Sanitize every input at the boundary of every `calculate()`: confirm zod validators exist for every input across all seed calculators and report any that lack one. Add a build-time check that fails if a `CalculatorConfig` input has no `validator`.

STEP 6 — Add `npm audit --audit-level=high` and `npm audit --audit-level=critical` to the CI workflow (Prompt 16 will consume this). Add a `dependabot.yml` with weekly cadence for npm.

STEP 7 — Self-audit:
- curl -I https://<staging-url> and confirm every security header is present.
- curl https://<staging-url>/admin/indexation without a token and confirm 401.
- Grep the dist bundle for known secret values and confirm zero matches.
- List every third-party host referenced in the CSP and confirm each is actually used.

Report each as PASS/FAIL.