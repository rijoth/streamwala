import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { PRODUCT_NAME } from '../../product.ts';

/**
 * The brand mark now exists in four places — the Android rasters, the splash
 * SVG, the favicon and the inline copy in `index.html` — and the browser build
 * plus CI have no Python at all, so `scripts/android-assets.py` can never be
 * re-run as part of a check. This suite is the drift guard: it fails when a
 * committed output disagrees with the generator's constants or with another
 * output, which is the failure that produced ADR 021 in the first place.
 */
const ROOT = process.cwd();
const read = (relative: string) => readFileSync(path.join(ROOT, relative), 'utf8');

const MARK = 'src/shared/ui/brand/streamwala-mark.svg';
const FAVICON = 'public/favicon.svg';
const INDEX = 'index.html';
const CSS = 'src/index.css';
const PYTHON = 'scripts/android-assets.py';

const PLATE = '#1B4578';
const GLYPH = '#A0CAFF';
const PIP = '#D6BDFB';
const SURFACE = '#0B0C13';
/** The SVG plate box; `scripts/android-assets.py` emits into these units. */
const UNITS = 1000;

function parseHtml(text: string) {
  return new DOMParser().parseFromString(text, 'text/html');
}

function markOf(text: string): SVGElement {
  const svg = parseHtml(text).querySelector('svg');
  if (!svg) throw new Error('no <svg> element found');
  return svg as unknown as SVGElement;
}

/** Reads a fraction-of-the-plate-side constant out of the generator. */
function fraction(name: string): number {
  const match = read(PYTHON).match(new RegExp(`^${name} = (\\d+(?:\\.\\d+)?)$`, 'm'));
  if (!match) throw new Error(`scripts/android-assets.py has no ${name} constant`);
  return Number(match[1]);
}

const derivative = (name: string) => String(Math.round(UNITS * fraction(name) * 10) / 10);

describe('generated brand assets', () => {
  it('draws the splash mark from the same constants as the Android artwork', () => {
    const svg = markOf(read(MARK));

    const plate = svg.querySelector('rect')!;
    expect(plate.getAttribute('width')).toBe(String(UNITS));
    expect(plate.getAttribute('rx')).toBe(derivative('PLATE_RADIUS'));
    expect(plate.getAttribute('fill')).toBe(PLATE);

    const glyph = svg.querySelector('path')!;
    expect(glyph.getAttribute('fill')).toBe('none');
    expect(glyph.getAttribute('stroke')).toBe(GLYPH);
    expect(glyph.getAttribute('stroke-width')).toBe(derivative('GLYPH_STROKE'));
    // PIL has no round caps, so the raster build stamps a disc at every vertex
    // (ADR 021 item 6); the vector build asks for a round stroke instead.
    expect(glyph.getAttribute('stroke-linecap')).toBe('round');
    expect(glyph.getAttribute('stroke-linejoin')).toBe('round');

    const pip = svg.querySelector('circle')!;
    expect(pip.getAttribute('cx')).toBe(derivative('PIP_CENTRE'));
    expect(pip.getAttribute('cy')).toBe(derivative('PIP_CENTRE'));
    expect(pip.getAttribute('r')).toBe(derivative('PIP_RADIUS'));
    expect(pip.getAttribute('fill')).toBe(PIP);
  });

  it('emits the glyph bowls at the geometry the constants describe', () => {
    const d = markOf(read(MARK)).querySelector('path')!.getAttribute('d')!;
    const point = (x: number, y: number) =>
      `${Math.round(x * 10) / 10} ${Math.round(y * 10) / 10}`;
    const centre = UNITS / 2;
    const rx = UNITS * fraction('GLYPH_RX');
    const ry = UNITS * fraction('GLYPH_RY');

    // Starts at the upper bowl's right terminal, (centre + rx, centre - ry)…
    expect(d.startsWith(`M${point(centre + rx, centre - ry)} `)).toBe(true);
    // …and passes over the top of that bowl, two bowl radii above the centre.
    expect(d).toContain(`L${point(centre, centre - 2 * ry)} `);
  });

  it('keeps the splash mark background-free so one asset serves every theme', () => {
    const svg = markOf(read(MARK));

    expect(svg.querySelectorAll('rect')).toHaveLength(1);
    expect(svg.getAttribute('aria-hidden')).toBe('true');
  });

  it('draws the favicon as the same mark on the brand background, inset', () => {
    const svg = markOf(read(FAVICON));
    const [background, plate] = Array.from(svg.querySelectorAll('rect'));

    expect(background.getAttribute('fill')).toBe(SURFACE);
    expect(background.getAttribute('width')).toBe(String(UNITS));
    expect(plate.getAttribute('fill')).toBe(PLATE);

    // Inset mark: the plate no longer fills the canvas, but the spine is the
    // same polyline, so both files must have the same number of segments.
    expect(plate.getAttribute('width')).not.toBe(String(UNITS));
    const segments = (text: string) =>
      [...markOf(text).querySelector('path')!.getAttribute('d')!.matchAll(/L/g)].length;
    expect(segments(read(FAVICON))).toBe(segments(read(MARK)));
  });

  it('inlines that exact mark in index.html for the pre-React paint', () => {
    const inline = parseHtml(read(INDEX)).querySelector('#root svg');
    expect(inline).not.toBeNull();

    const normalize = (text: string) => text.replace(/\s+(?=<)/g, '').trim();
    expect(normalize(inline!.outerHTML)).toBe(normalize(markOf(read(MARK)).outerHTML));
  });

  it('uses the surface-dim token values for the pre-CSS splash', () => {
    const html = read(INDEX);
    const css = read(CSS);

    expect([...html.matchAll(/--boot-surface:\s*(#[0-9a-fA-F]{6})/g)].map((m) => m[1].toUpperCase())).toEqual(
      [':root', 'html\\.theme-light', 'html\\.theme-amoled'].map((block) =>
        css
          .match(new RegExp(`${block}\\s*\\{([^}]*)\\}`))?.[1]
          .match(/--md-sys-color-surface-dim:\s*(#[0-9a-fA-F]{6})/)?.[1]
          .toUpperCase()
      )
    );
  });

  it('sizes the pre-React mark exactly as the app does', () => {
    const declaration = /--brand-mark-size:\s*([^;]+);/;
    expect(read(INDEX).match(declaration)?.[1].trim()).toBe(
      read(CSS).match(declaration)?.[1].trim()
    );
  });

  it('keeps the frozen storage key and the product name literal honest', () => {
    const html = read(INDEX);

    // The pre-paint theme script cannot import the settings store, and the
    // inlined name cannot import product.ts (ADR 019, ADR 022).
    expect(html).toContain('aether_iptv_settings_v1');
    expect(html).toContain(PRODUCT_NAME);
  });
});
