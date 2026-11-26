# On-call: one page

Opus Calculator is run by one person, so "on call" means one owner and a short list of who to ask. **Fill in the contact lines before launch.** Nothing here is filled in with a real name, number or address, on purpose.

## Contacts

| Role                                        | Who                 | How to reach                                               | When                                        |
| ------------------------------------------- | ------------------- | ---------------------------------------------------------- | ------------------------------------------- |
| Owner and first responder                   | `[NAME]`            | `[PHONE]` / `[PERSONAL EMAIL]`                             | Always, first call                          |
| Backup (someone who can roll back a deploy) | `[NAME]`            | `[PHONE]` / `[EMAIL]`                                      | If the owner has not answered in 30 minutes |
| Cloudflare                                  | account owner login | https://dash.cloudflare.com, support through the dashboard | Hosting, DNS, Access problems               |
| GitHub                                      | repository admin    | https://github.com/basicappcompany/opuscalculator          | Repository or access problems               |
| Domain registrar                            | `[REGISTRAR]`       | `[ACCOUNT / SUPPORT LINK]`                                 | Domain or DNS ownership problems            |
| Ad network                                  | `[NETWORK]`         | `[SUPPORT LINK]`                                           | Account warnings and appeals                |
| Legal or privacy adviser                    | `[NAME]`            | `[EMAIL]`                                                  | A breach with personal data, a DMCA dispute |

## Order and hours

1. **Site down or a security problem:** act at any hour. Roll back first ([ROLLBACK.md](ROLLBACK.md)), tell the backup if you cannot, write it up later.
2. **Traffic drop or an ad warning:** handle the same day, in working hours. These do not get worse in a night.
3. **Everything else** (a wrong result reported, a copyright notice, an accessibility report): reply within the times the site promises: wrong results first; accessibility within 10 business days; privacy requests within 30 days.

## First five minutes, any incident

1. Is the site up? `curl -I https://opuscalculator.com/`
2. Did anything deploy in the last hour? Cloudflare Pages, Deployments.
3. If yes and the timing fits, roll back that deployment.
4. Open [INCIDENT_RUNBOOK.md](INCIDENT_RUNBOOK.md) at the matching section.
5. Start a timestamped note.

## Things to have ready (check each quarter)

- [ ] Two-factor sign-in works on GitHub, Cloudflare and the registrar, and recovery codes are stored offline.
- [ ] The backup person can sign in and roll back a deployment (practise it once).
- [ ] The three mailboxes receive mail: hello@, dmca@ and access@ opuscalculator.com.
- [ ] `npm run audit:prelaunch -- --base https://opuscalculator.com` passes today.
- [ ] The Search Console service-account key is no more than a year old.
