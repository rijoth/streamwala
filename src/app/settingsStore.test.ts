import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, beforeEach } from 'vitest';
import { applyTheme } from './settingsStore.ts';
import { DEFAULT_SETTINGS, AppSettings } from '../domain/types.ts';

/** Regression: BUG — light mode rendered identically to dark mode because
 * `html.theme-light` had no token block in src/index.css. */

const css = readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf8');

function tokensIn(block: string): Set<string> {
  return new Set(block.match(/--md-sys-color-[a-z-]+(?=\s*:)/g) ?? []);
}

function themeBlock(selector: string): string {
  const start = css.indexOf(selector);
  expect(start, `${selector} missing from index.css`).toBeGreaterThan(-1);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  return css.slice(open, close);
}

describe('applyTheme', () => {
  beforeEach(() => {
    document.documentElement.className = '';
  });

  const cases: Array<[AppSettings['theme'], string | null]> = [
    ['dark', null],
    ['amoled', 'theme-amoled'],
    ['light', 'theme-light'],
  ];

  it.each(cases)('maps theme %s to the %s root class', (theme, expectedClass) => {
    applyTheme({ ...DEFAULT_SETTINGS, theme });

    const classes = document.documentElement.classList;
    expect(classes.contains('theme-light')).toBe(expectedClass === 'theme-light');
    expect(classes.contains('theme-amoled')).toBe(expectedClass === 'theme-amoled');
  });

  it('switching between themes never leaves both variant classes set', () => {
    applyTheme({ ...DEFAULT_SETTINGS, theme: 'light' });
    applyTheme({ ...DEFAULT_SETTINGS, theme: 'amoled' });
    expect(document.documentElement.classList.contains('theme-light')).toBe(false);
    expect(document.documentElement.classList.contains('theme-amoled')).toBe(true);

    applyTheme({ ...DEFAULT_SETTINGS, theme: 'dark' });
    expect(document.documentElement.classList.contains('theme-light')).toBe(false);
    expect(document.documentElement.classList.contains('theme-amoled')).toBe(false);
  });

  it('light theme redefines every M3 color token declared for dark mode', () => {
    const darkTokens = tokensIn(themeBlock(':root'));
    const lightTokens = tokensIn(themeBlock('html.theme-light'));

    expect(darkTokens.size).toBeGreaterThan(20);
    const missing = [...darkTokens].filter((token) => !lightTokens.has(token));
    expect(missing).toEqual([]);
  });
});
