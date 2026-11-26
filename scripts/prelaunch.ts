// Pre-launch checklist for the things only the owner can supply. Not part of the build, so CI stays green while they
// are open.   npm run prelaunch     Exit code 1 while any item is open.
//
// It reports facts written in the repo (src/config/site.ts, src/content/reviewers.ts). Deploy-time facts, such as whether
// the mailboxes receive mail, are listed as manual checks because a script cannot know them.
import { SITE } from '../src/config/site';
import { REVIEWERS } from '../src/content/reviewers';
import { YMYL_CATEGORIES } from '../src/content/disclaimers';

interface Item {
  ok: boolean;
  label: string;
  how: string;
}

export function prelaunchItems(): Item[] {
  const unreviewed = YMYL_CATEGORIES.filter((c) => !REVIEWERS[c]);
  return [
    {
      ok: SITE.jurisdiction.trim() !== '',
      label: 'Governing jurisdiction for the terms',
      how: 'Set SITE.jurisdiction in src/config/site.ts (for example "the State of X, USA").',
    },
    {
      ok: SITE.legalReviewed,
      label: 'Legal pages read by a qualified person',
      how: 'After a lawyer has read /privacy, /terms and /dmca for your jurisdiction, set SITE.legalReviewed = true.',
    },
    {
      ok: unreviewed.length === 0,
      label: `Reviewers named for YMYL categories (${unreviewed.length} without one: ${unreviewed.join(', ') || 'none'})`,
      how: 'Optional. Add a real reviewer with real credentials in src/content/reviewers.ts, or leave empty and rely on the "Unaudited calculators" section of the editorial policy.',
    },
  ];
}

export default function main(): number {
  const items = prelaunchItems();
  for (const i of items) console.log(`${i.ok ? 'PASS' : 'OPEN'}  ${i.label}${i.ok ? '' : `\n      ${i.how}`}`);
  console.log('\nManual checks (a script cannot know these):');
  for (const m of [
    `${SITE.email.general}, ${SITE.email.dmca} and ${SITE.email.accessibility} receive mail`,
    'A DMCA designated agent is registered with the US Copyright Office if you want safe-harbour protection',
    'Privacy page matches the real ad network and analytics provider in use on launch day',
    'Consent banner exists if ads load in the EEA, UK or Switzerland',
  ])
    console.log(`  [ ] ${m}`);
  const open = items.filter((i) => !i.ok && !i.label.startsWith('Reviewers')).length;
  return open ? 1 : 0;
}
