/**
 * The design skins (owner request, 27 Nov): every design option on the real site, picked from a "Design" menu that only
 * appears in preview mode (open any page with ?design). A skin changes colour, type, corner radius, shadow style and spacing
 * through the same tokens the site already uses (src/styles/tokens.css); a layout flavour and a density change how the pages
 * are arranged. Nothing here runs for a normal visitor: the skins file is loaded only in preview mode.
 *
 * Accessibility is built in, not hoped for: the palette builder nudges every colour until text is at least 4.5:1 (7:1 for the
 * high-contrast skin) against both the page and the card, control outlines are at least 3:1, and white text on the result card
 * is at least 4.5:1. tests/skins.test.ts checks every skin in light and dark.
 *
 * Pure functions: public/skins.css and the catalogue in docs/ux-directions.html are generated from this data by
 * `npm run skins`, and a test fails if either is out of date.
 */

// ---------- colour maths ----------
type Rgb = [number, number, number];
const clamp = (n: number, lo = 0, hi = 255): number => Math.min(hi, Math.max(lo, n));
export const toRgb = (hex: string): Rgb => {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};
export const toHex = (c: Rgb): string => `#${c.map((v) => Math.round(clamp(v)).toString(16).padStart(2, '0')).join('')}`;
const channel = (v: number): number => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
export const luminance = (hex: string): number => {
  const [r, g, b] = toRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};
/** WCAG contrast ratio, 1 to 21. */
export const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
/** `t` of the way from a to b. */
export const mix = (a: string, b: string, t: number): string => {
  const [x, y] = [toRgb(a), toRgb(b)];
  return toHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
};
const toHsl = (hex: string): [number, number, number] => {
  const [r, g, b] = toRgb(hex).map((v) => v / 255) as Rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
};
const fromHsl = (h: number, s: number, l: number): string => {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return toHex([f(0) * 255, f(8) * 255, f(4) * 255]);
};
/** The same colour one step lighter (positive) or darker (negative). */
export function shiftLightness(hex: string, delta: number): string {
  const [h, sat, l] = toHsl(hex);
  return fromHsl(h, sat, Math.min(1, Math.max(0, l + delta)));
}
/** Moves `color` lighter or darker, a little at a time, until it has at least `min` contrast against every colour in `against`. */
export function ensureContrast(color: string, against: string[], min: number, direction: 'darker' | 'lighter'): string {
  const [h, s, l0] = toHsl(color);
  let l = l0;
  let out = color;
  for (let i = 0; i < 100 && !against.every((bg) => contrast(out, bg) >= min); i += 1) {
    l = direction === 'darker' ? l - 0.01 : l + 0.01;
    if (l < 0 || l > 1) break;
    out = fromHsl(h, s, l);
  }
  if (!against.every((bg) => contrast(out, bg) >= min)) out = direction === 'darker' ? '#000000' : '#ffffff';
  return out;
}

// ---------- skin data ----------
export interface BasePalette {
  bg: string;
  card: string;
  fg: string;
  accent: string;
  accent2: string;
}
export type ShadowStyle = 'soft' | 'flat' | 'hard' | 'glow';
export type LayoutFlavour = 'standard' | 'instrument' | 'focus';
export type Density = 'comfortable' | 'compact';

export interface SkinSpec {
  id: string;
  name: string;
  /** One line on what it feels like and who it suits. */
  mood: string;
  light: BasePalette;
  dark: BasePalette;
  /** Corner radii in px: small, medium, large. */
  radius: [number, number, number];
  shadow: ShadowStyle;
  /** Font stacks; each defaults to the site's own. */
  sans?: string;
  display?: string;
  mono?: string;
  /** Heading letter-spacing in em (negative is tighter). */
  tracking?: number;
  /** Tailwind's spacing step in rem (the site's default is 0.25). */
  spacing?: number;
  /** AAA (7:1) text contrast instead of AA (4.5:1). */
  aaa?: boolean;
  /** The layout flavour that suits this skin; the picker applies it when the skin is chosen, and the visitor can change it. */
  layout?: LayoutFlavour;
}

export interface Tokens {
  bg: string;
  fg: string;
  muted: string;
  card: string;
  border: string;
  borderStrong: string;
  accent: string;
  accentFg: string;
  accentStrong: string;
  accentSoft: string;
  accent2: string;
  danger: string;
  dangerSoft: string;
  success: string;
  warn: string;
  warnSoft: string;
  heroFrom: string;
  heroTo: string;
  shadowSm: string;
  shadowMd: string;
  shadowLg: string;
}

const WHITE = '#ffffff';
const INK = '#0a0a0a';
const STATUS = {
  light: { danger: '#c2262e', success: '#0f7a4a', warn: '#8a5a00' },
  dark: { danger: '#ff8a90', success: '#4cd694', warn: '#f5c451' },
};

function rgba(hex: string, a: number): string {
  const [r, g, b] = toRgb(hex);
  return `rgb(${r} ${g} ${b} / ${a})`;
}

function shadows(style: ShadowStyle, dark: boolean, fg: string, accent: string): [string, string, string] {
  const ink = dark ? '#000000' : fg;
  switch (style) {
    case 'flat':
      return ['none', 'none', 'none'];
    case 'hard':
      return [`2px 2px 0 ${fg}`, `4px 4px 0 ${fg}`, `6px 6px 0 ${fg}`];
    case 'glow':
      return [
        `0 0 0 1px ${rgba(accent, 0.25)}`,
        `0 0 0 1px ${rgba(accent, 0.3)}, 0 8px 28px ${rgba(accent, 0.22)}`,
        `0 0 0 1px ${rgba(accent, 0.35)}, 0 18px 48px ${rgba(accent, 0.3)}`,
      ];
    default:
      return [
        `0 1px 2px ${rgba(ink, dark ? 0.4 : 0.06)}`,
        `0 4px 14px ${rgba(ink, dark ? 0.4 : 0.08)}`,
        `0 16px 40px ${rgba(dark ? '#000000' : accent, dark ? 0.5 : 0.16)}`,
      ];
  }
}

/** Every token of one skin in one theme, with contrast enforced. */
export function buildTokens(spec: SkinSpec, theme: 'light' | 'dark'): Tokens {
  const base = spec[theme];
  const dark = theme === 'dark';
  const min = spec.aaa ? 7 : 4.5;
  const away = dark ? 'lighter' : 'darker';
  const { bg, card } = base;
  const surfaces = [bg, card];

  // Accent first (readable as text on the page and the card), then its soft background: text also has to read on that.
  const soft = (a: string): string => mix(card, a, dark ? 0.16 : 0.1);
  let accent = ensureContrast(base.accent, surfaces, min, away);
  // The tint is made from the accent, so move the accent until it reads on its own tint as well (a link inside the banner).
  for (let i = 0; i < 60 && contrast(accent, soft(accent)) < min; i += 1)
    accent = ensureContrast(shiftLightness(accent, away === 'darker' ? -0.01 : 0.01), surfaces, min, away);
  const accentSoft = soft(accent);
  const status = STATUS[theme];
  const dangerSoft = mix(card, status.danger, dark ? 0.16 : 0.09);
  const warnSoft = mix(card, status.warn, dark ? 0.16 : 0.1);
  // Every background text can sit on: the page, the card and the soft tints (the "Results in USD" banner is accent-soft).
  const grounds = [bg, card, accentSoft, dangerSoft, warnSoft];

  const fg = ensureContrast(base.fg, grounds, min, away);
  // Muted text: as far toward the background as still reads on all of them.
  let muted = mix(fg, bg, 0.4);
  for (let t = 0.4; t >= 0 && !grounds.every((g) => contrast(muted, g) >= min); t -= 0.02) muted = mix(fg, bg, t);
  const border = mix(bg, fg, spec.aaa ? 0.35 : 0.14);
  const borderStrong = ensureContrast(mix(card, fg, 0.5), surfaces, 3.1, away);

  const accentFg = contrast(WHITE, accent) >= contrast(INK, accent) ? WHITE : INK;
  const accentStrong = ensureContrast(mix(accent, fg, 0.35), grounds, min, away);
  const accent2 = ensureContrast(base.accent2, surfaces, 3, away);

  const danger = ensureContrast(status.danger, [...surfaces, dangerSoft], min, away);
  const success = ensureContrast(status.success, surfaces, min, away);
  const warn = ensureContrast(status.warn, [...surfaces, warnSoft], min, away);

  // The result card keeps white text in both themes, so both ends of its gradient must hold white at 4.5:1.
  const heroFrom = ensureContrast(base.accent, [WHITE], 4.6, 'darker');
  const heroTo = ensureContrast(base.accent2, [WHITE], 4.6, 'darker');

  const [shadowSm, shadowMd, shadowLg] = shadows(spec.shadow, dark, fg, accent);
  return {
    bg,
    fg,
    muted,
    card,
    border,
    borderStrong,
    accent,
    accentFg,
    accentStrong,
    accentSoft,
    accent2,
    danger,
    dangerSoft,
    success,
    warn,
    warnSoft,
    heroFrom,
    heroTo,
    shadowSm,
    shadowMd,
    shadowLg,
  };
}

// ---------- CSS ----------
const decl = (name: string, value: string): string => `  --${name}: ${value};`;

function colourBlock(t: Tokens, dark: boolean): string[] {
  return [
    decl('color-bg', t.bg),
    decl('color-fg', t.fg),
    decl('color-muted', t.muted),
    decl('color-card', t.card),
    decl('color-border', t.border),
    decl('color-border-strong', t.borderStrong),
    decl('color-accent', t.accent),
    decl('color-accent-fg', t.accentFg),
    decl('color-accent-strong', t.accentStrong),
    decl('color-accent-soft', t.accentSoft),
    decl('color-accent-2', t.accent2),
    decl('color-danger', t.danger),
    decl('color-danger-soft', t.dangerSoft),
    decl('color-success', t.success),
    decl('color-warn', t.warn),
    decl('color-warn-soft', t.warnSoft),
    decl('color-hero-from', t.heroFrom),
    decl('color-hero-to', t.heroTo),
    decl('shadow-sm', t.shadowSm),
    decl('shadow-md', t.shadowMd),
    decl('shadow-lg', t.shadowLg),
    `  color-scheme: ${dark ? 'dark' : 'light'};`,
  ];
}

export function skinCss(spec: SkinSpec): string {
  const light = buildTokens(spec, 'light');
  const dark = buildTokens(spec, 'dark');
  const sel = `:root[data-skin='${spec.id}']`;
  const shape: string[] = [
    decl('radius-sm', `${spec.radius[0]}px`),
    decl('radius-md', `${spec.radius[1]}px`),
    decl('radius-lg', `${spec.radius[2]}px`),
    ...(spec.sans ? [decl('font-sans', spec.sans)] : []),
    ...(spec.mono ? [decl('font-mono', spec.mono)] : []),
    ...(spec.spacing ? [decl('spacing', `${spec.spacing}rem`)] : []),
    decl('skin-display', spec.display ?? spec.sans ?? 'var(--font-sans)'),
    decl('skin-tracking', `${spec.tracking ?? 0}em`),
  ];
  return [
    `/* ${spec.name}: ${spec.mood} */`,
    `${sel} {`,
    ...shape,
    ...colourBlock(light, false),
    '}',
    `${sel}[data-theme='dark'] {`,
    ...colourBlock(dark, true),
    '}',
    '@media (prefers-color-scheme: dark) {',
    `  ${sel}:not([data-theme='light']) {`,
    ...colourBlock(dark, true).map((l) => `  ${l}`),
    '  }',
    '}',
    `.opus-swatch[data-swatch='${spec.id}'] {`,
    `  --sw-bg: ${light.bg};`,
    `  --sw-card: ${light.card};`,
    `  --sw-fg: ${light.fg};`,
    `  --sw-accent: ${light.accent};`,
    `  --sw-accent2: ${light.accent2};`,
    `  --sw-dbg: ${dark.bg};`,
    `  --sw-dcard: ${dark.card};`,
    `  --sw-dfg: ${dark.fg};`,
    `  --sw-daccent: ${dark.accent};`,
    '}',
    '',
  ].join('\n');
}

/** Layout flavours and density: arrangement only, so they work with every skin. Written by hand, appended to the generated skins. */
export const LAYOUT_CSS = `/* Layout flavours (the "Layout" choice) and density. Arrangement only, so they combine with any skin. */

/* Headings take the skin's display face and tracking. */
:root[data-skin] :is(h1, h2, h3) {
  font-family: var(--skin-display);
  letter-spacing: var(--skin-tracking);
}
:root[data-skin] .result-value {
  font-variant-numeric: tabular-nums;
}

/* Density */
:root[data-density='compact'] {
  --spacing: 0.21rem;
  --text-base: 0.9375rem;
  --text-sm: 0.8125rem;
}

/* Instrument: a working tool. The inputs and the result sit side by side and the result stays in view while you scroll,
   numerals line up, and the page chrome gets out of the way. On a phone the result is pinned to the bottom edge. */
:root[data-layout='instrument'] {
  --text-base: 0.9375rem;
  --text-sm: 0.8125rem;
  font-variant-numeric: tabular-nums;
}
:root[data-layout='instrument'] main {
  max-width: 76rem;
}
:root[data-layout='instrument'] #calculator {
  display: grid;
  gap: var(--space-4);
  align-items: start;
  padding: var(--space-4);
}
@media (min-width: 64rem) {
  :root[data-layout='instrument'] #calculator {
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
  }
  :root[data-layout='instrument'] #calculator .result-card {
    position: sticky;
    top: 5rem;
    margin-top: 0;
  }
}
:root[data-layout='instrument'] h1 {
  font-size: var(--text-2xl);
}
:root[data-layout='instrument'] [data-toolbar-root] {
  gap: var(--space-1);
}
@media (max-width: 40rem) {
  /* On a phone the tool must be on the first screen: the intro shows its first two lines, the rest is still on the page. */
  :root[data-layout='instrument'] article > header p {
    display: -webkit-box;
    overflow: hidden;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
}
@media (max-width: 40rem) {
  :root[data-layout='instrument'] #calculator .result-card {
    position: sticky;
    bottom: 0;
    z-index: 5;
    margin: 0 calc(var(--space-4) * -1) calc(var(--space-4) * -1);
    border-radius: var(--radius-md) var(--radius-md) 0 0;
    padding: var(--space-3) var(--space-4);
  }
}

/* Focus: one narrow column, the answer as large as it will go. For reading on a phone and for screenshots. */
:root[data-layout='focus'] main {
  max-width: 44rem;
}
:root[data-layout='focus'] .result-card .result-value {
  font-size: var(--text-4xl);
}
:root[data-layout='focus'] aside {
  display: none;
}

/* The design picker and its swatches (preview mode only: this file is not loaded otherwise). */
.opus-swatch {
  display: inline-grid;
  grid-template-columns: repeat(4, 1fr);
  width: 100%;
  height: 1.5rem;
  overflow: hidden;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
}
.opus-swatch i:nth-child(1) {
  background: var(--sw-bg);
}
.opus-swatch i:nth-child(2) {
  background: var(--sw-accent);
}
.opus-swatch i:nth-child(3) {
  background: var(--sw-fg);
}
.opus-swatch i:nth-child(4) {
  background: var(--sw-dbg);
}
`;

export function skinsCss(specs: readonly SkinSpec[]): string {
  return [
    '/* GENERATED by `npm run skins` from src/lib/skins-data.ts. Do not edit by hand. Loaded only in design-preview mode (any page with ?design). */',
    '',
    ...specs.map(skinCss),
    LAYOUT_CSS,
  ].join('\n');
}

/** What the picker needs to list the skins: loaded only in preview mode, so a normal page carries none of it. */
export function skinsJson(specs: readonly SkinSpec[]): string {
  return `${JSON.stringify(
    specs.map((s) => ({ id: s.id, name: s.name, mood: s.mood, layout: s.layout ?? '' })),
    null,
    2,
  )}
`;
}

export const skinById = (specs: readonly SkinSpec[], id: string): SkinSpec | undefined => specs.find((s) => s.id === id);
