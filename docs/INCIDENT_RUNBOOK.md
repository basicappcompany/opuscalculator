# Incident runbook

Four incidents are covered: the site is down, traffic falls sharply (suspected deindexing), the ad account is suspended, and a security breach. Each has detection, the first 15 minutes, the first hour, communication and a write-up. Roll-back steps are in [ROLLBACK.md](ROLLBACK.md). Who to call is in [RUNBOOK_ONCALL.md](RUNBOOK_ONCALL.md).

General rules for every incident:

1. **Stop the damage first, understand it second.** Roll back before you debug.
2. **Write as you go.** Keep a timestamped note of what you saw and what you changed. It becomes the write-up.
3. **Change one thing at a time** and check the effect.
4. **Never push to `main` directly**, even in an incident: use a pull request (release flow in CLAUDE.md). A Cloudflare Pages roll-back needs no code at all.
5. **Never put a secret in a note, a ticket or a chat.**

---

## 1. Site down

**Trigger:** the uptime monitor reports two consecutive failures of the home page, or you see errors yourself. (Monitoring is not set up until tracker items on Sentry and uptime are done; until then this is found by hand.)

**Detection**

- Uptime alert from the home page, `/calculators/bmi-calculator/` or `/sitemap-index.xml`.
- A visitor email to the contact address.
- `curl -I https://opuscalculator.com/` returns anything other than 200.

**First 15 minutes**

1. Confirm it is real and where: `curl -I https://opuscalculator.com/` and the same for one calculator and `/sitemap-index.xml`; open the site from a phone on mobile data to rule out your network.
2. Check Cloudflare's own status page, and the Cloudflare dashboard for the Pages project (a failed deployment shows there).
3. Look at the last deploy: Cloudflare Pages, Deployments. Did a deploy go out just before the failure?
4. If the last deploy is the likely cause, **roll back** to the previous deployment (ROLLBACK.md, section 1). This takes under two minutes and needs no code.
5. If DNS or the domain is the problem (the site does not resolve), check the domain registration and the DNS records in Cloudflare.

**First hour**

- If the roll-back fixed it: leave it rolled back, open a pull request that reverts or fixes the bad change, and only then deploy forward.
- If nothing changed on our side and Cloudflare reports an incident: wait, check every 15 minutes, and post nothing public beyond a one-line note if visitors ask.
- If the site is up but wrong (a page returns 404 that should not): run `npm run audit:prelaunch -- --base https://opuscalculator.com` to see which checks fail.

**Communication**

- There is no status page. If the outage lasts more than an hour, put a one-line note on the contact page after the site is back, saying when it happened and that it is fixed.

**Root-cause write-up** (within 2 working days): what happened, how it was detected and how long it took, what fixed it, what stops it happening again. Add a one-line summary to the status page timeline.

---

## 2. Traffic drop of more than 30% in 7 days (suspected deindexing)

**Trigger:** weekly Search Console clicks or impressions are more than 30% below the previous week, or `npm run indexation` shows indexation falling.

**Detection**

- Search Console Performance report, last 7 days against the previous 7.
- Plausible visitors, last 7 days against the previous 7.
- The weekly indexation check (`npm run indexation`, then `npm run dashboard`).

**First 15 minutes**

1. Check Search Console, Security and Manual Actions: is there a manual action or a security issue? If yes, that is the cause: follow Google's message.
2. Check that nothing was released: `git log --since="10 days ago" --oneline origin/main`. A cohort promotion, a `noindex` change or a deploy just before the drop is the first suspect.
3. Fetch `https://opuscalculator.com/robots.txt`: is it the expected file, with no new `Disallow: /`?
4. Open a few key pages and look for an accidental `noindex` meta tag or a canonical pointing somewhere else: `curl -s https://opuscalculator.com/calculators/bmi-calculator/ | grep -i -E "robots|canonical"`.

**First hour**

1. Export the Search Console Pages (Coverage) report and compare "Indexed" and the reasons for not indexed against the last export.
2. Run `npm run indexation` and `npm run dashboard`, and compare indexation by cohort. A drop confined to one cohort points at that cohort's pages (quality, duplication, a template change).
3. Compare sitemap URL counts: `grep -c "<loc>" dist/sitemap-*.xml` on a fresh build against what Search Console says was submitted. A sitemap that lost URLs, or gained unpublished ones, is a bug.
4. Check the promotion gate and flags: `COHORT_*` in Cloudflare Pages against what you expect.
5. If a cohort is the cause and it was promoted recently, **roll the cohort back** (ROLLBACK.md, section 2).
6. Check whether the drop is a Google update (look at industry sources for a core update on the same dates). If it is, do not change the site in a hurry: improve the weakest pages and wait for the next evaluation.

**Communication:** none needed publicly. Record the finding in the tracker.

**Root-cause write-up:** include the date range, the Search Console evidence, what was changed, and the recovery. Add the lesson to the promotion rules if a gate would have caught it.

---

## 3. Ad account suspension

**Trigger:** an email or dashboard notice from the ad network that the account or the site is limited, suspended or disabled, or ad revenue falls to zero without a deploy.

**Detection:** the ad network's notice; revenue report; the ad slot showing blank.

**First 15 minutes**

1. Read the notice. Do not ignore a policy warning even if the account still works.
2. **Remove the ad script within the hour.** Clear `PUBLIC_AD_SCRIPT_URL` in the Cloudflare Pages environment variables and trigger a new deployment (or redeploy the last build after the variable change). The slot then stays an empty placeholder and loads nothing.
3. Do not click your own ads and do not try to test them.

**First hour**

1. Identify the policy named in the notice and find the pages it concerns.
2. Check that the site matches what the policy asks: content policy, ad placement (one slot, below the calculator, labelled "Advertisement"), consent for regions that require it, a working privacy page.
3. Fix what is wrong in a pull request.
4. File the appeal through the network's own form, in plain words, saying what you changed. Do it once and keep the reference.

**Communication:** none public. The ad disclosure and privacy pages stay accurate: if ads are off, say nothing misleading about them.

**Do not redeploy ads until the appeal is resolved.** Then set the variable again and redeploy.

**Root-cause write-up:** the policy cited, the change made, the appeal result, the date ads returned.

---

## 4. Security breach (unauthorised commit, exposed secret)

**Trigger:** a commit or pull request you did not make; a secret found in the repository, a build log, the site's files or a screenshot; a Cloudflare, GitHub or domain-registrar sign-in you do not recognise; a defaced page.

**Detection**

- `git log origin/main --format="%h %an %ae %ad %s"` shows an unknown author or an odd time.
- The build's `check-security` step fails, or a secret scanner (GitHub secret scanning) emails you.
- A Cloudflare or GitHub security alert email.

**First 15 minutes**

1. **Contain.** If a deploy is bad, roll back the deployment (ROLLBACK.md, section 1). If the repository is compromised, disable the Cloudflare Pages build trigger so nothing new ships.
2. **Rotate every secret that could have been exposed**, not only the one you found: the Search Console service-account key (create a new key and delete the old one), any API tokens, and GitHub personal access tokens. Removing a secret from the code does not make it safe: it must be replaced.
3. **Invalidate Cloudflare Access sessions** for `/admin/*` (Zero Trust, Access, revoke user sessions) and review who has access.
4. Change the passwords and review two-factor on GitHub, Cloudflare and the domain registrar.

**First hour**

1. Review the full history: `git log --all --format="%h %an %ae %ad %s"` and the GitHub audit log (Settings, Audit log) and Cloudflare's audit log.
2. Identify the first bad change and what it touched. If it was a commit, revert it by pull request and force no one: do not rewrite public history unless a secret must be purged, and if it must, do it deliberately and rotate the secret anyway.
3. Run `npm run verify` on a clean clone of `main` to confirm the site is what the repository says.
4. If personal data may have been exposed (the site holds almost none; check Plausible and any email inbox), note exactly what and for whom.

**Communication**

- If personal data of other people was exposed, **notify the affected people and, where the law requires, the regulator within 72 hours** of becoming aware. The privacy page says what the site holds.
- Tell Cloudflare and GitHub support if the account itself was breached.

**Root-cause write-up:** how the access was gained, what was touched, what was rotated and when, and the control that closes the gap (for example required reviews, a narrower token, a secret scanner).
