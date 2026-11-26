# Distribution checklist

Operational checklist for the free channels that can send referral traffic or backlinks without outreach. No promotional copy lives here: write each post fresh, in your own words, about a real calculator.

**How this was built.** Every rule below was read from the platform's own page on 2026-11-23 and the source is given. Where a page could not be read, or a fact (usually dofollow or nofollow) is not stated anywhere I could see, it says **UNVERIFIED** and what was tried. Do not treat UNVERIFIED as a yes or a no. Re-read the source before posting: these rules change. Re-verify everything at least every 6 months.

**Before any channel.** Only Cohort 1 pages are live (5 calculators plus 4 hubs), so there is little to submit until a cohort is promoted (`CLAUDE.md` rule 5). Never submit an unpublished or noindex URL. A submitted URL must return 200 and be in the sitemap (`npm run audit` and `verify-dist` check this on the build).

Status legend: `[ ]` to do, `[x]` done, with the date and URL of what was submitted.

**Open for the owner:** the UNVERIFIED lines for Indie Hackers, Medium and AlternativeTo and every Reddit row are tracker item 10.5. Reddit and those three sites refused automated reading on 2026-11-23, so they have to be read in a browser by you. Do not post anywhere until its row is filled in.

## 1. Launch and listing channels

### Product Hunt

- Source: https://help.producthunt.com/en/collections/19793093-launch-guide (the Launch Guide, read 2026-11-23). https://www.producthunt.com/launch redirects here.
- **URL:** sign in with a personal account, then click "Submit" (top right). Start by pasting the product link at "Get started". No separate `/submit` URL is documented.
- **Format** (article "Build your product page", https://help.producthunt.com/en/articles/17834537-4-build-your-product-page):
  - Product link: direct link, no link shorteners. If the same link launched in the last two months you must request a relaunch.
  - Name up to 40 characters, tagline up to 60, description up to 500.
  - Logo required: 240x240 px recommended, JPG, PNG or GIF, up to 2 MB.
  - Gallery: at least 1 image required, 1270x760 px recommended. Video or demo link optional.
  - Launch tags: required, up to 3. Role: "I made this" or "I'm hunting it". Maker first comment: up to 5,000 characters.
  - "Create draft" saves without review. Scheduled launches are reviewed before they go live, up to 30 days ahead.
- **Account:** a personal account with a verified email. Launches and comments must come from personal accounts, not company accounts (article "Launch FAQ and myths", https://help.producthunt.com/en/articles/17734646-8-launch-faq-and-myths).
- **Dofollow or nofollow:** the help articles do not say, so this is from the page HTML. On a real product page (https://www.producthunt.com/products/notion, read 2026-11-23) the product's website link is `rel="noreferrer noopener ugc"`: marked as user-generated content, which Google treats as a hint not to pass ranking credit. Count it as referral traffic, not a ranking backlink. One page sampled.
- **Rate limits:** no daily cap found. Relaunch only when you ship a major feature or update (article 7, https://help.producthunt.com/en/articles/17734411-7-relaunch-your-product); less than two months since the last launch needs a relaunch request that the team reviews. Launches that try to bypass the duplicate check are removed.
- **Rules that matter** (article 5, https://help.producthunt.com/en/articles/17734384-5-how-to-promote-your-launch-and-what-to-avoid): never ask for upvotes; no upvote contests, no paid upvotes or comments, no fake or extra accounts, no spam or mass DMs. Posting a link in communities you have never been active in is called out as the wrong move.
- [ ] Do once, when a good set of calculators is live. One launch, not one per calculator.

### Indie Hackers

- **UNVERIFIED.** https://www.indiehackers.com/products/new and https://www.indiehackers.com/guidelines both returned HTTP 403 to automated fetching on 2026-11-23. Read them in a browser and fill this in: product submission URL, post format, link attributes, group and self-promotion rules, rate limits.
- [ ] Read the guidelines in a browser first, then decide whether to post. Build-in-public posts only; follow the guidelines on links.

### Dev.to

- Sources: https://dev.to/p/editor_guide, https://dev.to/code-of-conduct, https://dev.to/guidelines-for-ai-assisted-articles-on-dev (read 2026-11-23).
- **URL:** https://dev.to/new (sign in with GitHub, Google, Apple, Facebook, MLH, X or email).
- **Format:** front matter fields `title`, `published`, `description`, `tags` (maximum 4, comma separated), `canonical_url`, `cover_image` (best size 1000 x 420), `series`, `ai_disclosure_level` (`not_disclosed`, `no_ai`, `some_ai`, `fully_autonomous`). A title length limit and account-age requirements are not stated on the pages read.
- **Canonical:** `canonical_url` is supported. When the same text also exists on opuscalculator.com, set it to the opuscalculator.com URL so the original keeps the credit.
- **Dofollow or nofollow:** mostly followed in one sampled article. In the article https://dev.to/sylwia-lask/is-coding-with-ai-actually-faster-and-cheaper-2810 (read 2026-11-23), 12 of 13 outbound links in the body had `rel="noopener noreferrer"` (no nofollow) and 1 had `nofollow`. Dev.to's own help page is not a user post and says nothing about it. One article sampled, so treat as "may be followed, may not", and re-check on your own post once published.
- **Rate limits:** none stated.
- **Rules that matter:**
  - AI-assisted articles are allowed but must be disclosed, either with the tag `#ABotWroteThis` or in the text. Do not publish unreviewed AI output.
  - Articles must not promote a business, program or course, including your own.
  - An article whose main purpose is to build backlinks for another site can get the account suspended or banned.
  - So a Dev.to post has to be a real technical write-up (for example how the exact-decimal amortization schedule works), not an ad for the site. A link to the calculator is incidental.
- [ ] Optional. Only a genuine technical post.

### Medium

- **UNVERIFIED.** https://help.medium.com/hc/en-us/articles/214550207-Publishing-on-Medium and https://medium.com/policy/medium-rules-30e5502c4eb4 returned HTTP 403 on 2026-11-23, and both URLs were from memory, not from a page link. Read Medium's help centre in a browser and fill in: publishing URL, the canonical-link import tool, publication submission rules, link attributes, limits.
- [ ] Read the rules in a browser first.

## 2. Directories

### SaaSHub

- Source: https://www.saashub.com/services/submit (read 2026-11-23).
- **URL:** https://www.saashub.com/services/submit (the "Submit Product" page). Registration and login are required.
- **Format:** the form itself was not readable, so fields, limits and logo or screenshot rules are UNVERIFIED. Documented rules:
  - All submitted products go through an approval process. No timing is given.
  - Rejected: products not in English, products on free subdomains, products not released yet. Accepted: most software products and apps.
  - "List Competitors" is a step. A submission with no listed competitors is slowed down and put at the bottom of the queue.
  - Verifying ownership gives higher priority and needs an email address on the product's domain (so use an address at opuscalculator.com).
  - Stated: SaaSHub may reject or remove products even after approval.
  - Their page asks AI agents not to submit for a person; a human submits.
- **Free listing:** UNVERIFIED. The submit page does not state pricing. (The directory-submission tool page says its own list is free, which is a different thing.)
- **Dofollow or nofollow:** on the alternatives page https://www.saashub.com/calculator-net-alternatives (read 2026-11-23), the ranked list entries are `rel="nofollow"` (16 links) or `rel="sponsored"` (5 links). The prominent "visit website" button at the top of a product's own page has no `rel`, i.e. a normal followed link (for example the calculator.net button). So a SaaSHub listing is likely to give one followed link from the product's own page and nofollow links from the lists. One page sampled; confirm on your own listing after approval.
- **Rate limits:** none stated.
- **Ranks for "calculator alternatives"?** The platform does have such pages: https://www.saashub.com/calculator-net-alternatives ("calculator.net Alternatives & Competitors", updated 2026-11-22, more than 10 entries ranked by votes and reviews, some marked sponsored) and https://www.saashub.com/best-online-calculators-software. Whether they rank in Google for those queries was not checked. Check in Search Console after listing.
- [ ] Submit the site once, verified with an address on the domain.

### AlternativeTo

- **UNVERIFIED.** https://alternativeto.net/suggest/ returned 404 (permanent) and the homepage has no visible link to a submit or add page. The sign-up page is https://alternativeto.net/signup. Find the current "add application" path after signing in, in a browser, then record: URL, required fields, owner self-submission rule, link attributes, limits.
- [ ] Find the current path, read the guidelines, then decide.

## 3. Reddit

Reddit refuses automated fetching (both www.reddit.com and old.reddit.com), so these rules must be read in a browser and recorded here. Do not post anywhere until its row is filled in from the live rules page. Most of these communities restrict or ban self-promotion and some require account age or karma.

| Subreddit               | Rules page                                                 | Tool links | Condition and rule quoted | Frequency limit | Read on |
| ----------------------- | ---------------------------------------------------------- | ---------- | ------------------------- | --------------- | ------- |
| r/InternetIsBeautiful   | https://www.reddit.com/r/InternetIsBeautiful/about/rules   | TO READ    |                           |                 |         |
| r/SideProject           | https://www.reddit.com/r/SideProject/about/rules           | TO READ    |                           |                 |         |
| r/webdev                | https://www.reddit.com/r/webdev/about/rules                | TO READ    |                           |                 |         |
| r/alphaandbetausers     | https://www.reddit.com/r/alphaandbetausers/about/rules     | TO READ    |                           |                 |         |
| r/SaaS                  | https://www.reddit.com/r/SaaS/about/rules                  | TO READ    |                           |                 |         |
| r/startups              | https://www.reddit.com/r/startups/about/rules              | TO READ    |                           |                 |         |
| r/Entrepreneur          | https://www.reddit.com/r/Entrepreneur/about/rules          | TO READ    |                           |                 |         |
| r/personalfinance       | https://www.reddit.com/r/personalfinance/about/rules       | TO READ    |                           |                 |         |
| r/loseit                | https://www.reddit.com/r/loseit/about/rules                | TO READ    |                           |                 |         |
| r/financialindependence | https://www.reddit.com/r/financialindependence/about/rules | TO READ    |                           |                 |         |

Classify each as ALLOWED, BANNED or RESTRICTED (weekly thread only, a named day, flair required, minimum account age or karma).

## 4. Link attributes (dofollow or nofollow)

No help page states link attributes. What is recorded above comes from the raw HTML of one real page per platform on 2026-11-23 (Product Hunt: `ugc`; Dev.to: followed, one `nofollow`; SaaSHub: list links `nofollow` or `sponsored`, product-page button followed). Indie Hackers, Medium, AlternativeTo and Reddit are still UNVERIFIED (the first three refused or hid their pages from automated reading, and Reddit refuses automated reading outright). Platforms change this, so re-check your own published post or listing with this console snippet, replacing nothing:

```js
[...document.querySelectorAll('a[href^="http"]')].filter((a) => !a.href.includes(location.hostname)).map((a) => `${a.rel || '(no rel)'}  ${a.href}`);
```

`nofollow`, `ugc` or `sponsored` in `rel` means the link passes no ranking credit. Record the result and date for each channel. Treat nofollow links as referral traffic only, which is still worth having.

## 5. Weekly task

Every week, after the Search Console check (`npm run indexation`, see README "Promoting a cohort"):

1. Pick up to 5 calculators that were published since the last run and are indexed (their rows in `indexation.csv`, not "Crawled, currently not indexed").
2. For each, check that it returns 200, has one h1 and a self-referencing canonical, and shows its default result with JavaScript off.
3. Submit them where the channel allows it, one channel per week, rotating, and only where that channel's row above says tool links are allowed. A single post may cover several calculators; do not post five times.
4. Write the post by hand about what the calculator does or what you learned building it. No templated text, no asking for votes.
5. Log it below: date, channel, URL posted, result after a week (clicks in Search Console or Plausible).

| Date | Channel | Calculators | Post URL | Result after 7 days |
| ---- | ------- | ----------- | -------- | ------------------- |

Rate limits to respect: the per-channel limits above, and never post the same link to more than one community on the same day.
