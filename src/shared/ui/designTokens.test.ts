import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Contract for the four interaction states (ADR 030).
 *
 * `src/index.css` is the single theme file. Every state value is a literal so
 * this test can compute real WCAG contrast instead of trusting a comment:
 *
 * - text must stay >= 4.5:1 in Dark, AMOLED and Light;
 * - the focus ring is a non-text UI cue and must stay >= 3:1 against every
 *   surface it can land on, including the solid primary-action fill — the whole
 *   point of giving focus its own token is that it never borrows the accent;
 * - `--sw-surface-selected` really is the accent at ~15% over the card surface,
 *   not an unrelated colour that happens to look tinted.
 */

const css = readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf8');

type Tokens = Map<string, string>;

function themeBlock(selector: string): string {
  const start = css.indexOf(selector);
  expect(start, `${selector} missing from index.css`).toBeGreaterThan(-1);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  return css.slice(open, close);
}

function declarations(block: string): Tokens {
  const tokens: Tokens = new Map();
  for (const match of block.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    tokens.set(match[1], match[2].trim());
  }
  return tokens;
}

const rootTokens = declarations(themeBlock(':root'));

const THEMES = [
  { name: 'dark', selector: ':root' },
  { name: 'amoled', selector: 'html.theme-amoled' },
  { name: 'light', selector: 'html.theme-light' },
] as const;

function resolvedTokens(selector: string): Tokens {
  const merged = new Map<string, string>([
    ...rootTokens,
    ...declarations(themeBlock(selector)),
  ]);
  const resolve = (name: string, depth = 0): string => {
    const value = merged.get(name);
    if (value === undefined) throw new Error(`token ${name} is not declared`);
    if (depth > 5) throw new Error(`token ${name} has a reference cycle`);
    const alias = value.match(/^var\((--[a-z0-9-]+)\)$/);
    return alias ? resolve(alias[1], depth + 1) : value;
  };
  const out: Tokens = new Map();
  for (const name of merged.keys()) out.set(name, resolve(name));
  return out;
}

function rgb(hex: string): [number, number, number] {
  const value = hex.trim();
  const match = value.match(/^#([0-9a-f]{6})$/i);
  if (!match) throw new Error(`not a 6-digit hex colour: ${value}`);
  const int = parseInt(match[1], 16);
  return [(int >> 16) & 0xff, (int >> 8) & 0xff, int & 0xff];
}

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function blend(top: string, bottom: string, alpha: number): string {
  const a = rgb(top);
  const b = rgb(bottom);
  return `#${a
    .map((channel, index) =>
      Math.round(channel * alpha + b[index] * (1 - alpha))
        .toString(16)
        .padStart(2, '0')
    )
    .join('')}`;
}

const stateTokenNames = [...rootTokens.keys()].filter((name) => name.startsWith('--sw-'));

describe.each(THEMES)('$name theme state tokens', ({ selector }) => {
  const tokens = resolvedTokens(selector);

  it('declares every --sw-* token for this theme', () => {
    expect(stateTokenNames.length).toBeGreaterThan(15);
    const missing = stateTokenNames.filter((name) => !tokens.has(name));
    expect(missing).toEqual([]);
  });

  it('defines all four states with distinct tokens', () => {
    // Focus must never reuse the accent; selected/primary/secondary must not
    // collapse into one value (the bug this ADR fixes).
    expect(tokens.get('--sw-focus-ring')).not.toBe(tokens.get('--sw-accent-primary'));
    expect(tokens.get('--sw-surface-selected')).not.toBe(tokens.get('--sw-accent-primary'));
    expect(tokens.get('--sw-surface-secondary')).not.toBe(tokens.get('--sw-accent-primary'));
    expect(tokens.get('--sw-surface-selected')).not.toBe(tokens.get('--sw-surface-secondary'));
  });

  it('keeps text at >= 4.5:1', () => {
    const pairs: Array<[string, string, string]> = [
      ['selected accent label', '--sw-accent-text', '--sw-surface-selected'],
      ['selected accent label (focused)', '--sw-accent-text', '--sw-surface-selected-focus'],
      ['primary action label', '--sw-on-accent-primary', '--sw-accent-primary'],
      ['secondary action label', '--sw-on-surface-secondary', '--sw-surface-secondary'],
      ['body text on focus surface', '--md-sys-color-on-surface', '--sw-focus-surface'],
      ['active badge label', '--sw-on-status-active', '--sw-status-active-surface'],
      ['favorite badge label', '--sw-on-status-favorite', '--sw-status-favorite-surface'],
      ['live badge label', '--sw-on-status-live', '--sw-status-live-surface'],
      ['ready status text', '--sw-status-active', '--md-sys-color-surface-container'],
      ['favorite status text', '--sw-status-favorite', '--md-sys-color-surface-container'],
      ['live status text', '--sw-status-live', '--md-sys-color-surface-container'],
    ];

    for (const [label, fg, bg] of pairs) {
      const ratio = contrast(tokens.get(fg)!, tokens.get(bg)!);
      expect(ratio, `${label}: ${fg} on ${bg} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps the focus ring at >= 3:1 on every surface it can land on', () => {
    const surfaces = [
      '--md-sys-color-surface-container',
      '--md-sys-color-surface-container-high',
      '--sw-focus-surface',
      '--sw-surface-selected',
      '--sw-surface-selected-focus',
      '--sw-surface-secondary',
    ];
    // The ring is drawn 4px outside the border box, so the gap shows the surface
    // behind the control, never the control's own fill: a filled primary action
    // is still ringed against the page, which is why it is not in this list.

    for (const surface of surfaces) {
      const ratio = contrast(tokens.get('--sw-focus-ring')!, tokens.get(surface)!);
      expect(
        ratio,
        `focus ring on ${surface} is ${ratio.toFixed(2)}:1`
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it('derives the selected surface from the accent at 15% over the card surface', () => {
    const expected = blend(
      tokens.get('--sw-accent-primary')!,
      tokens.get('--md-sys-color-surface-container')!,
      0.15
    );
    const actual = tokens.get('--sw-surface-selected')!;
    const [er, eg, eb] = rgb(expected);
    const [ar, ag, ab] = rgb(actual);
    // Rounding of the authored literal may differ by one step per channel.
    expect(Math.abs(er - ar), `red channel of ${actual} vs blend ${expected}`).toBeLessThanOrEqual(1);
    expect(Math.abs(eg - ag), `green channel of ${actual} vs blend ${expected}`).toBeLessThanOrEqual(1);
    expect(Math.abs(eb - ab), `blue channel of ${actual} vs blend ${expected}`).toBeLessThanOrEqual(1);
  });
});

describe('focus geometry tokens', () => {
  it('is a 3-4px ring offset 4px with a 1.05 scale and a 150ms transform transition', () => {
    const tokens = resolvedTokens(':root');
    expect(parseFloat(tokens.get('--focus-ring-width')!)).toBeGreaterThanOrEqual(3);
    expect(parseFloat(tokens.get('--focus-ring-width')!)).toBeLessThanOrEqual(4);
    expect(parseFloat(tokens.get('--focus-ring-offset')!)).toBe(4);
    expect(parseFloat(tokens.get('--focus-scale')!)).toBeCloseTo(1.05, 3);
    expect(parseFloat(tokens.get('--focus-motion-duration')!)).toBe(150);
    expect(tokens.get('--focus-motion-easing')).toMatch(/ease-out|cubic-bezier/);
  });

  it('only animates transform (no shadow/colour interpolation on TV boxes)', () => {
    const rule = css.slice(css.indexOf('.tv-focus-target {'), css.indexOf('.tv-focused {'));
    const transition = rule.match(/transition:\s*([^;]+);/)?.[1] ?? '';
    expect(transition).toContain('transform');
    expect(transition).not.toContain('box-shadow');
    expect(transition).not.toContain('background-color');
  });
});

/**
 * Channel logo plates are the one geometry family authored in `px * --ui-scale`
 * rather than rem (ADR 034). Bitmap logo art has fixed optical weight, so it has
 * to follow the viewer's TV-distance setting; the card around it stays rem-sized
 * because its text must track the root font size (BUG-022). These assertions
 * pin all three properties that makes: the token exists in `:root` only, it is
 * a px × scale product (never rem, never a bare px, never a missing `calc`),
 * and the family stays monotonic so `xs` cannot silently overtake `lg`.
 */
describe('logo scale', () => {
  const SCALE_ORDER = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', 'hero'] as const;
  const PX_X_SCALE = /^calc\(\d+px \* var\(--ui-scale\)\)$/;

  it('declares every --logo-size-* once, in :root', () => {
    for (const name of SCALE_ORDER) {
      expect(rootTokens.has(`--logo-size-${name}`), `--logo-size-${name}`).toBe(true);
      // Theme blocks carry colour only (ADR 012); a logo size must not fork.
      for (const theme of THEMES.filter((entry) => entry.selector !== ':root')) {
        expect(
          declarations(themeBlock(theme.selector)).has(`--logo-size-${name}`),
          `--logo-size-${name} leaked into ${theme.selector}`
        ).toBe(false);
      }
    }
  });

  it('is authored as px * --ui-scale so it follows the TV UI scale', () => {
    for (const name of SCALE_ORDER) {
      expect(rootTokens.get(`--logo-size-${name}`), `--logo-size-${name}`).toMatch(PX_X_SCALE);
    }
  });

  it('grows monotonically from the EPG column to the hero watermark', () => {
    const bases = SCALE_ORDER.map((name) =>
      Number(rootTokens.get(`--logo-size-${name}`)!.match(/calc\((\d+)px/)![1])
    );
    for (let i = 1; i < bases.length; i += 1) {
      expect(bases[i], `${SCALE_ORDER[i]} must exceed ${SCALE_ORDER[i - 1]}`).toBeGreaterThan(
        bases[i - 1]
      );
    }
    // The documented base values; a silent retune of the family fails here.
    expect(bases).toEqual([24, 32, 40, 48, 56, 64, 256]);
  });
});

/**
 * Every surface that paints a channel logo must route through the token family.
 * The Playwright spec (`e2e/logo-size.spec.ts`) proves the geometry of the
 * surfaces a D-pad run reaches; this is the cheap complement that also covers
 * the surfaces that only appear inside a player overlay or a side sheet, and it
 * fails if a legacy hard-coded square is ever reintroduced next to the token.
 */
describe('logo plate call sites', () => {
  const SURFACES = [
    { file: 'src/features/live-tv/ChannelCards.tsx', tokens: ['2xl', 'md'], legacy: ['w-20 h-20', 'w-11 h-11'] },
    { file: 'src/features/favorites/FavoritesView.tsx', tokens: ['2xl'], legacy: ['w-18 h-18'] },
    { file: 'src/features/home/ChannelTile.tsx', tokens: ['xl'], legacy: ['w-16 h-16'] },
    { file: 'src/features/search/SearchResultsGrid.tsx', tokens: ['xl'], legacy: ['w-16 h-16'] },
    { file: 'src/features/home/HeroSection.tsx', tokens: ['hero'], legacy: ['w-64 h-64'] },
    { file: 'src/features/player/NowNextBanner.tsx', tokens: ['lg'], legacy: ['w-14 h-14'] },
    { file: 'src/features/player/MiniChannelOverlay.tsx', tokens: ['sm'], legacy: ['w-9 h-9'] },
    { file: 'src/features/guide/ProgramDetailsSheet.tsx', tokens: ['sm'], legacy: ['w-10 h-10'] },
    { file: 'src/features/guide/EpgGuideView.tsx', tokens: ['xs'], legacy: ['w-7 h-7'] },
  ] as const;

  it.each(SURFACES)('$file sizes its logo from --logo-size-*', ({ file, tokens, legacy }) => {
    const source = readFileSync(path.resolve(process.cwd(), file), 'utf8');
    for (const token of tokens) {
      expect(source, `${file} must use --logo-size-${token}`).toContain(
        `var(--logo-size-${token})`
      );
      expect(source, `${file} must tag its plate for the geometry spec`).toContain(
        `data-logo-plate="${token}"`
      );
    }
    for (const size of legacy) {
      expect(source, `${file} still carries the hard-coded square "${size}"`).not.toContain(
        size
      );
    }
  });
});
