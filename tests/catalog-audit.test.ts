import { describe, expect, it } from 'vitest';
import { AUDIT_GROUPS, CATALOG_AUDIT } from '../src/config/catalog-audit';
import { registry } from '../src/lib/registry';

describe('catalog audit flags', () => {
  const all = new Map([...registry.valid, ...registry.excluded].map((c) => [c.slug, c]));

  it('every audited slug is a real calculator, so a rename cannot leave a stale flag', () => {
    const missing = [...CATALOG_AUDIT.keys()].filter((slug) => !all.has(slug));
    expect(missing).toEqual([]);
  });

  it('a slug is in one group only and every group has a reason', () => {
    const slugs = AUDIT_GROUPS.flatMap((g) => g.slugs);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const g of AUDIT_GROUPS) expect(g.reason.length).toBeGreaterThan(20);
  });

  it('the registry attaches the flag to the config', () => {
    const flagged = registry.valid.filter((c) => c.audit);
    expect(flagged.length).toBe([...CATALOG_AUDIT.keys()].filter((slug) => registry.valid.some((c) => c.slug === slug)).length);
    for (const c of flagged) expect(c.audit).toEqual(CATALOG_AUDIT.get(c.slug));
  });
});
