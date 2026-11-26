# Rollback

Three rollbacks: a deploy, a cohort, and a Cloudflare Access policy change. Each lists the exact steps and how to confirm it worked. These steps were written from the Cloudflare and GitHub documentation; **none has been run yet because the site is not deployed** (tracker 9.6 and 9.7). The first time you roll back, for real or as a drill, check the steps against the dashboard and correct this file.

Practise once before launch: roll the site back one deployment and forward again, and confirm both states with `curl -I https://opuscalculator.com/` and `npm run audit:prelaunch -- --base https://opuscalculator.com`.

## 1. Roll back a deploy (Cloudflare Pages)

Use this when a deploy broke the site or a page. It needs no code and is the first move in an incident.

1. Open the Cloudflare dashboard, **Workers & Pages**, the opuscalculator project, **Deployments**.
2. Find the last deployment that was good (the one before the bad one; production deployments are labelled "Production").
3. Open its menu (three dots) and choose **Rollback to this deployment** (Cloudflare calls it "Rollback"). Confirm.
4. Wait a minute, then check: `curl -I https://opuscalculator.com/` returns 200, and a page that was broken is fixed.
5. **Roll forward** when the fix is merged: push a new deployment by merging the fix pull request; Cloudflare builds it from `main`. Check the same URLs again.

Notes

- A rollback changes what is served, not the `main` branch. `main` still contains the bad change, so a later deploy will bring it back: revert it by pull request (`git revert <commit>` on a branch, then the normal release flow).
- Environment variables are part of a deployment: a rollback restores the variables that deployment was built with.

## 2. Roll back a cohort

Use this when a cohort that was promoted needs to come down (indexation fell, a template bug, a quality problem). Cohort 1 can be rolled back too, but then nothing is live: only do that for a real emergency.

1. In Cloudflare Pages, **Settings, Environment variables**, set the cohort's flag to `false` for Production: `COHORT_2_PUBLISHED=false` (or `COHORT_3_PUBLISHED=false`).
2. Trigger a new deployment (**Deployments, Retry deployment** on the latest build, or merge any pull request). The build now excludes those pages: they stop being built, leave every sitemap and hub, and return 404.
3. **Why 404 is not enough for a page that was indexed:** while a page is gone, search engines keep it for a while. If you want it out of the index quickly and permanently, add its path to `src/config/gone.json` by pull request: the Pages Function then answers 410 Gone, which is removed faster than 404.
4. **To keep pages reachable but out of search** (instead of removing them), set them to noindex: `npm run prune -- --write` records pages in `src/config/pruned.json`, and the next build gives them `noindex` and takes them out of the sitemaps while they stay linked. Use this for pages that exist but have not earned a place.
5. Check: `npm run audit:prelaunch -- --base https://opuscalculator.com` (published pages 200, unpublished 404, no sitemap lists an unpublished page) and Search Console, Sitemaps, that the cohort's sitemap file no longer exists.
6. To bring the cohort back, the promotion gate applies again: `npm run gate` must say ALLOWED from fresh data before the flag can be set to `true` (the build refuses otherwise).

## 3. Roll back a Cloudflare Access policy change

Use this when a change to who can reach `/admin/*` locked people out, or opened the area too widely.

1. Cloudflare Zero Trust dashboard, **Access, Applications**, the application that protects `opuscalculator.com/admin/*`.
2. Open **Policies** and look at the policy history or note what it was before (take a screenshot of the working policy whenever you change it, because Access does not keep an easy history).
3. **Opened too widely:** change the policy action back to **Allow** only for the named email(s), or temporarily set the policy to **Block** for everyone until it is fixed. `functions/_middleware.ts` still answers 401 to any `/admin/` request with no Access token, so a block at the Access level fails closed.
4. **Locked out:** from another administrator account, or from the Cloudflare account owner login, restore the Allow rule for your email.
5. Check: `curl -I https://opuscalculator.com/admin/indexation` with no token returns 401 (or the Access login redirect), and a signed-in browser reaches the page.
6. Revoke sessions if the policy was ever too wide: Zero Trust, **Users, Revoke session**.

## Related

- Incident steps and who decides: [INCIDENT_RUNBOOK.md](INCIDENT_RUNBOOK.md), [RUNBOOK_ONCALL.md](RUNBOOK_ONCALL.md).
- Why cohorts exist and the gate: [adr/003-cohort-gated-rollout.md](adr/003-cohort-gated-rollout.md).
