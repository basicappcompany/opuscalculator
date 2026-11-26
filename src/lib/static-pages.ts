/**
 * The site's own pages: about, policies and legal. One list drives the footer, the sitemap and the tests, so a page
 * that is linked is always one that exists and is listed (CLAUDE.md rule 6).
 */
export interface StaticPage {
  path: string;
  /** Footer and sitemap label. */
  label: string;
  title: string;
  description: string;
  /** Linked from the footer of every page. */
  footer: boolean;
}

export const STATIC_PAGES: readonly StaticPage[] = [
  {
    path: '/agents/',
    label: 'For AI agents',
    title: 'Opus Calculator for AI agents: MCP server, llms.txt and JSON index',
    description:
      'Connect an AI assistant or agent to Opus Calculator: a read-only MCP server that runs the same exact calculators, plus llms.txt, markdown copies and a JSON index.',
    footer: true,
  },
  {
    path: '/about/',
    label: 'About',
    title: 'About Opus Calculator: exact calculators for people and AI agents',
    description: 'Who runs Opus Calculator, why it exists, what the site promises, and how each calculator is built and tested.',
    footer: true,
  },
  {
    path: '/contact/',
    label: 'Contact',
    title: 'Contact Opus Calculator',
    description:
      'How to reach Opus Calculator, and what kinds of message get a reply: corrections, formula questions, accessibility problems and copyright notices.',
    footer: true,
  },
  {
    path: '/editorial-policy/',
    label: 'Editorial policy',
    title: 'Editorial policy: how calculators are written, tested and reviewed',
    description:
      'How every calculator is written, tested to the cent, checked by the quality gate, reviewed for health and finance, and corrected when it is wrong.',
    footer: true,
  },
  {
    path: '/how-we-make-money/',
    label: 'How we make money',
    title: 'How Opus Calculator makes money: one ad per page',
    description: 'A plain explanation of the one-ad-per-page model, why ad placement never changes a result, and what the site does not do.',
    footer: true,
  },
  {
    path: '/privacy/',
    label: 'Privacy',
    title: 'Privacy policy: what Opus Calculator collects and what it does not',
    description:
      'Cookie-free analytics, what the browser stores on your device, advertising cookies, hosting logs, and your rights to access, delete and move your data.',
    footer: true,
  },
  {
    path: '/terms/',
    label: 'Terms',
    title: 'Terms of use for Opus Calculator',
    description:
      'The rules for using Opus Calculator: acceptable use, ownership, no warranty, limitation of liability, governing law and changes to these terms.',
    footer: true,
  },
  {
    path: '/ad-disclosure/',
    label: 'Ad disclosure',
    title: 'Ad disclosure: how advertising works on Opus Calculator',
    description: 'The site is paid for by ads. Ads sit below the calculator, never change a result, and no calculator needs a click on an ad.',
    footer: true,
  },
  {
    path: '/accessibility/',
    label: 'Accessibility',
    title: 'Accessibility statement: WCAG 2.2 AA target and known limits',
    description: 'The accessibility target for Opus Calculator, how it is checked, the known limitations, and how to report a barrier.',
    footer: true,
  },
  {
    path: '/dmca/',
    label: 'DMCA',
    title: 'DMCA and copyright notices for Opus Calculator',
    description: 'How to send a copyright takedown notice or a counter-notice to Opus Calculator, with the designated contact address.',
    footer: true,
  },
];

export const FOOTER_PAGES = STATIC_PAGES.filter((p) => p.footer);

/** Every page must link all of these from its footer (Prompts 12 and 18). */
export const REQUIRED_FOOTER_PATHS: readonly string[] = FOOTER_PAGES.map((p) => p.path);
