import { test, expect } from '@playwright/test';
import { waitForAppReady } from './helpers.ts';

/**
 * Icon-font regression coverage (ADR 036), geometry only — jsdom cannot measure
 * text, so a component test cannot tell an icon glyph from the literal word.
 *
 * The bug: Material Symbols is a *ligature* font, so the DOM holds the words
 * `arrow_forward` / `live_tv`. Loading it from Google Fonts with
 * `font-display: swap` painted those words until a 5.4 MB woff2 arrived, and
 * never resolved them at all when the CDN was unreachable (offline APK).
 *
 * Two properties are asserted here:
 *   1. an icon renders as a glyph, not as text — its box is square-ish at the
 *      requested size, while the word `arrow_forward` at 24 px would be >150 px
 *      wide;
 *   2. the font is served from the app origin, with no request to a font CDN.
 */

/** Width/height of the first icon matching `selector`, once fonts have settled. */
async function measure(page: import('@playwright/test').Page, selector: string) {
  return page.evaluate(async (sel) => {
    await document.fonts.ready;
    const el = document.querySelector<HTMLElement>(sel);
    if (!el) return null;
    const box = el.getBoundingClientRect();
    return {
      width: box.width,
      height: box.height,
      text: el.textContent?.trim() ?? '',
      isSvg: el.tagName.toLowerCase() === 'svg',
    };
  }, selector);
}

test('ligature icons paint glyphs, never their ligature names', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);

  // A font-rendered icon: the nav rail's Home entry (24 px design size).
  const glyph = await measure(page, '.material-symbols-rounded');
  expect(glyph).not.toBeNull();
  // An icon glyph is square; the same word in the fallback face is a paragraph.
  expect(glyph!.width).toBeLessThanOrEqual(glyph!.height * 2);
  expect(glyph!.height).toBeGreaterThan(8);
});

test('brand-scale marks render as inline SVG, not as a webfont ligature', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);

  // `Icon name="live_tv"` is the onboarding plate and the hero watermark; both
  // are backed by the generated outline, so they exist before any font loads.
  const marks = await page.evaluate(() =>
    Array.from(document.querySelectorAll('svg.glyph-mark path')).map((path) => path.getAttribute('d'))
  );
  expect(marks.length).toBeGreaterThan(0);
  for (const path of marks) expect(path?.startsWith('M')).toBe(true);
});

test('serves fonts from the app origin and requests no font CDN', async ({ page }) => {
  const remote: string[] = [];
  const fontResponses: Array<{ url: string; status: number }> = [];
  page.on('request', (request) => {
    const url = request.url();
    if (/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(url)) remote.push(url);
  });
  page.on('response', (response) => {
    if (/\.woff2($|\?)/.test(response.url())) {
      fontResponses.push({ url: response.url(), status: response.status() });
    }
  });

  await page.goto('/');
  await waitForAppReady(page);
  await page.evaluate(() => document.fonts.ready);

  expect(remote).toEqual([]);

  // Every face the preloads announce must resolve locally, even the fallback
  // face (Plus Jakarta Sans) that only loads when Roboto Flex cannot cover a
  // glyph — a 404 there would be invisible until a translated string appears.
  expect(fontResponses.length).toBeGreaterThanOrEqual(3);
  for (const response of fontResponses) {
    expect(response.url).toContain('/fonts/');
    expect(response.status).toBe(200);
  }

  const loaded = await page.evaluate(() =>
    Array.from(document.fonts)
      .filter((face) => face.status === 'loaded')
      .map((face) => face.family.replace(/["']/g, ''))
  );
  // The icon font is the load-bearing one: without it every icon is a word.
  expect(loaded).toContain('Material Symbols Rounded');
  expect(loaded).toContain('Roboto Flex');
});
