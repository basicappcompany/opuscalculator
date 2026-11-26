import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SKINS } from '../src/lib/skins-data';
import { buildTokens, contrast, ensureContrast, mix, skinsCss, skinsJson } from '../src/lib/skins';

describe('colour maths', () => {
  it('matches the WCAG reference values', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrast('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
    expect(contrast('#767676', '#ffffff')).toBeCloseTo(4.54, 1); // the well-known AA grey
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
  });

  it('nudges a colour until it passes, in the direction asked, and never loops', () => {
    const fixed = ensureContrast('#aaaaaa', ['#ffffff'], 4.5, 'darker');
    expect(contrast(fixed, '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(ensureContrast('#777777', ['#ffffff'], 21, 'darker')).toBe('#000000'); // cannot be met: lands on the extreme
  });
});

describe('every skin is accessible in light and dark, by construction', () => {
  it('has at least 20 options, unique ids and names', () => {
    expect(SKINS.length).toBeGreaterThanOrEqual(20);
    expect(new Set(SKINS.map((s) => s.id)).size).toBe(SKINS.length);
    expect(new Set(SKINS.map((s) => s.name)).size).toBe(SKINS.length);
  });

  for (const skin of SKINS) {
    for (const theme of ['light', 'dark'] as const) {
      it(`${skin.name}, ${theme}: text, accents, outlines and the result card meet their ratios`, () => {
        const t = buildTokens(skin, theme);
        const min = skin.aaa ? 7 : 4.5;
        for (const surface of [t.bg, t.card]) {
          expect(contrast(t.fg, surface), 'text').toBeGreaterThanOrEqual(min);
          expect(contrast(t.muted, surface), 'muted text').toBeGreaterThanOrEqual(min);
          expect(contrast(t.accent, surface), 'accent as text').toBeGreaterThanOrEqual(min);
          expect(contrast(t.accentStrong, surface), 'accent-strong as text').toBeGreaterThanOrEqual(min);
          expect(contrast(t.danger, surface), 'danger').toBeGreaterThanOrEqual(min);
          expect(contrast(t.success, surface), 'success').toBeGreaterThanOrEqual(min);
          expect(contrast(t.warn, surface), 'warn').toBeGreaterThanOrEqual(min);
          expect(contrast(t.borderStrong, surface), 'control outline').toBeGreaterThanOrEqual(3);
        }
        for (const tint of [t.accentSoft, t.dangerSoft, t.warnSoft]) {
          expect(contrast(t.fg, tint), 'text on a soft tint').toBeGreaterThanOrEqual(min);
          expect(contrast(t.muted, tint), 'muted text on a soft tint').toBeGreaterThanOrEqual(min);
        }
        expect(contrast(t.danger, t.dangerSoft), 'danger on its soft background').toBeGreaterThanOrEqual(min);
        expect(contrast(t.accent, t.accentSoft), 'accent link on its own tint').toBeGreaterThanOrEqual(min);
        expect(contrast(t.accentFg, t.accent), 'button text on accent').toBeGreaterThanOrEqual(min);
        expect(contrast(t.accentStrong, t.accentSoft), 'chip text on accent-soft').toBeGreaterThanOrEqual(min);
        expect(contrast(t.warn, t.warnSoft), 'warn on its soft background').toBeGreaterThanOrEqual(min);
        expect(contrast('#ffffff', t.heroFrom), 'white on the result card, start').toBeGreaterThanOrEqual(4.5);
        expect(contrast('#ffffff', t.heroTo), 'white on the result card, end').toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});

describe('the generated stylesheet', () => {
  const css = skinsCss(SKINS);

  it('has light, dark and system-dark rules for every skin, and a swatch', () => {
    for (const s of SKINS) {
      expect(css, s.id).toContain(`:root[data-skin='${s.id}'] {`);
      expect(css, s.id).toContain(`:root[data-skin='${s.id}'][data-theme='dark'] {`);
      expect(css, s.id).toContain(`:root[data-skin='${s.id}']:not([data-theme='light']) {`);
      expect(css, s.id).toContain(`.opus-swatch[data-swatch='${s.id}']`);
    }
  });

  it('uses only system fonts (the CSP allows no font hosts) and no external URLs', () => {
    expect(css).not.toMatch(/url\(|@import|https?:\/\//);
  });

  it('is committed up to date: public/skins.json lists every skin for the picker', () => {
    expect(readFileSync('public/skins.json', 'utf8').replace(/\r\n/g, '\n')).toBe(skinsJson(SKINS));
    expect(JSON.parse(skinsJson(SKINS)).map((s: { id: string }) => s.id)).toEqual(SKINS.map((s) => s.id));
  });

  it('is committed up to date: public/skins.css is exactly what npm run skins writes', () => {
    expect(readFileSync('public/skins.css', 'utf8').replace(/\r\n/g, '\n')).toBe(css.replace(/\r\n/g, '\n'));
  });
});
