import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Drift guard for the self-hosted webfonts (ADR 036).
 *
 * The icon font is a *ligature* font: `Icon` renders the word `arrow_forward`
 * and the font turns it into a glyph. That makes two failures invisible to the
 * type checker and easy to reintroduce:
 *
 *   1. a component starts using an icon name that `scripts/build-fonts.py` did
 *      not subset — the glyph silently falls back to the literal words, i.e.
 *      exactly the cold-start bug this suite exists to prevent;
 *   2. someone re-adds a Google Fonts <link>, which reintroduces the network
 *      round trip (and the 5.4 MB variable font) on a cold TV start.
 *
 * Regenerate with `npm run fonts` when a test here fails for reason 1.
 */
const ROOT = process.cwd();
const read = (relative: string) => readFileSync(path.join(ROOT, relative), 'utf8');

const MANIFEST = 'src/shared/icons/icon-font.json';
const FONTS_CSS = 'src/fonts.css';
const INDEX = 'index.html';
const ICON_COMPONENT = 'src/shared/icons/Icon.tsx';
const GENERATED_GLYPHS = 'src/shared/icons/glyphPaths.generated.ts';
const FONTS_DIR = 'public/fonts';

interface Manifest {
  iconFont: {
    family: string;
    file: string;
    fontDisplay: string;
    sha256: string;
    bytes: number;
    glyphs: number;
    icons: string[];
  };
  textFaces: Array<{ family: string; file: string; fontDisplay: string }>;
  staticGlyphs: string[];
}

const manifest = JSON.parse(read(MANIFEST)) as Manifest;

/**
 * Icon names the components actually ask for: `<Icon name="x" />`,
 * `<Button icon="x" />`, `name={'x'}`/`icon={'x'}`, and the data entries that
 * feed `Icon name={item.icon}` (`{ id: 'live', icon: 'live_tv' }`).
 */
function requestedIcons(): Set<string> {
  const patterns = [
    /\b(?:name|icon)="([a-z][a-z0-9_]*)"/g,
    /\b(?:name|icon)=\{\s*'([a-z][a-z0-9_]*)'\s*\}/g,
    /\b(?:name|icon):\s*'([a-z][a-z0-9_]*)'/g,
  ];
  const names = new Set<string>();
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
        const text = read(full);
        for (const pattern of patterns) {
          for (const match of text.matchAll(pattern)) names.add(match[1]);
        }
      }
    }
  };
  walk('src');
  return names;
}

const subset = new Set(manifest.iconFont.icons);
const known = (name: string) => subset.has(name) || manifest.staticGlyphs.includes(name);

describe('self-hosted icon font', () => {
  it('ships the committed woff2 with the checksum the manifest records', () => {
    const file = path.join(FONTS_DIR, manifest.iconFont.file);
    expect(existsSync(file)).toBe(true);
    const digest = createHash('sha256').update(readFileSync(file)).digest('hex');
    expect(digest).toBe(manifest.iconFont.sha256);
    expect(statSync(file).size).toBe(manifest.iconFont.bytes);
  });

  it('subsets every icon name the app asks for', () => {
    const missing = [...requestedIcons()].filter((name) => !known(name)).sort();
    // A miss here means `npm run fonts` was not re-run after adding an icon,
    // and the new icon currently renders as the literal word `some_icon`.
    expect(missing).toEqual([]);
  });

  it('never paints ligature names with a swapping font', () => {
    // `block` reserves the glyph box; `swap` would paint `arrow_forward`.
    expect(manifest.iconFont.fontDisplay).toBe('block');
    expect(read(FONTS_CSS)).toMatch(
      new RegExp(
        `font-family: '${manifest.iconFont.family}';[\\s\\S]*?font-display: block;`
      )
    );
    for (const face of manifest.textFaces) {
      expect(face.fontDisplay).toBe('swap');
    }
  });

  it('serves every face locally, with the file present', () => {
    const css = read(FONTS_CSS);
    expect(css).not.toMatch(/https?:\/\//);
    const urls = [...css.matchAll(/url\('([^']+)'\)/g)].map((match) => match[1]);
    expect(urls.length).toBe(1 + manifest.textFaces.length);
    for (const url of urls) {
      expect(url.startsWith('/fonts/')).toBe(true);
      expect(existsSync(path.join('public', url))).toBe(true);
    }
  });

  it('keeps the icon font tiny next to the upstream variable font', () => {
    // The upstream file is 5.4 MB; anything in the megabytes here means the
    // subsetter fell back to ligature closure and shipped everything.
    expect(manifest.iconFont.bytes).toBeLessThan(400_000);
  });
});

describe('index.html font policy', () => {
  it('loads no remote font stylesheet', () => {
    const html = read(INDEX);
    expect(html).not.toContain('fonts.googleapis.com');
    expect(html).not.toContain('fonts.gstatic.com');
    expect(html).not.toMatch(/<link[^>]+rel="preconnect"[^>]*fonts\./);
  });

  it('preloads all three faces so the icon box is never empty', () => {
    const html = read(INDEX);
    const preloads = [...html.matchAll(/<link rel="preload" href="([^"]+)" as="font"/g)].map(
      (match) => match[1]
    );
    expect(preloads).toEqual(
      expect.arrayContaining([
        `/fonts/${manifest.iconFont.file}`,
        ...manifest.textFaces.map((face) => `/fonts/${face.file}`),
      ])
    );
    for (const href of preloads) {
      expect(existsSync(path.join('public', href))).toBe(true);
    }
  });
});

describe('static brand glyph', () => {
  it('covers the marks that used to flash words on a cold start', () => {
    // The onboarding plate (56 px) and the home hero watermark (140 px).
    expect(manifest.staticGlyphs).toEqual(['live_tv']);
    const generated = read(GENERATED_GLYPHS);
    expect(generated).toContain('export const STATIC_GLYPHS');
    expect(generated).toMatch(/path: 'M/);
    expect(generated).toMatch(/filledPath: 'M/);
  });

  it('is consulted before the ligature branch in Icon', () => {
    const component = read(ICON_COMPONENT);
    const staticIndex = component.indexOf('STATIC_GLYPHS[name]');
    const fontIndex = component.indexOf('material-symbols-rounded');
    expect(staticIndex).toBeGreaterThan(-1);
    expect(staticIndex).toBeLessThan(fontIndex);
  });

  it('never falls back to a ligature name the font does not have', () => {
    // `help_outline` was renamed to `help` upstream; the old fallback shipped
    // as the literal words "help_outline" for any unknown icon name.
    const component = read(ICON_COMPONENT);
    expect(component).toContain('help\n');
    expect(component).not.toContain('help_outline');
    expect(subset.has('help')).toBe(true);
  });
});
