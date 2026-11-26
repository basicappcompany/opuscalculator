import pruned from '../config/pruned.json';

/**
 * Calculator slugs set to noindex by the pruning rule (Prompt 8, item 3): zero impressions and zero clicks for 90
 * days. They stay built, crawlable and linked; they are only kept out of the sitemaps and marked noindex.
 * The list is written by `npm run prune` and committed through a pull request like any other change.
 */
export const PRUNED: ReadonlySet<string> = new Set((pruned as { slugs: string[] }).slugs);
export const isPruned = (slug: string): boolean => PRUNED.has(slug);
