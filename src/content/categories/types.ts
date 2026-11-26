import type { Category } from '../../lib/types';

export interface HubSection {
  heading: string;
  paragraphs: string[];
}

export interface HubSubcluster {
  /** Group heading on the hub, e.g. "Loans and mortgages". */
  label: string;
  /** One sentence under the heading. */
  blurb: string;
  /** Calculator slugs in display order. Slugs that are not published are skipped (CLAUDE.md rule 6). */
  slugs: string[];
}

export interface HubFeatured {
  slug: string;
  /** Two to three sentences, unique to this calculator, describing what it is for. Shown only once it is published. */
  blurb: string;
}

export interface HubGuideEntry {
  /** The situation, phrased the way a person would, e.g. "You are comparing loan offers". */
  situation: string;
  /** The calculator to start with. The entry is dropped while this slug is unpublished. */
  slug: string;
  /** Why this calculator fits the situation. */
  advice: string;
}

/** One file per category in src/content/categories/. This is data, not markup (Prompt 4). */
export interface HubContent {
  category: Category;
  /** <title>. Unique across the site. */
  title: string;
  metaDescription: string;
  h1: string;
  /** Opening paragraph above the calculator list. Counts toward the word minimum. */
  lede: string;
  /** The 800 to 1,200 word analysis (lede included): uses, common mistakes, how formulas relate, who benefits. */
  sections: HubSection[];
  subclusters: HubSubcluster[];
  featured: HubFeatured[];
  guide: HubGuideEntry[];
}
