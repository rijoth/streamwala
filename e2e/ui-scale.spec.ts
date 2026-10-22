import { test, expect, type Page } from '@playwright/test';
import { waitForAppReady } from './helpers.ts';

/**
 * ADR 035 regression matrix: one design-pixel unit derived from the viewport.
 *
 * The reported bug is a 4K TV that reports a 1280x720 CSS canvas (Android TV
 * density 320-480) and therefore rendered the fixed px chrome 1.5x too large:
 * a 96px rail (7.5% of the screen) and only ~3.5 grid cards. A 1280x720 canvas
 * must now be an exact 2/3 render of the 1920x1080 design: a 64px rail (5%)
 * and all six design columns.
 *
 * Every assertion is expressed in design px (`N * --u`), so the same spec also
 * proves the 960-3840 range and a DPR-3 device that mirrors the TV.
 */
test.describe.configure({ mode: 'serial' });

const CANVASES = [
  { width: 960, height: 540, deviceScaleFactor: 1 },
  { width: 1280, height: 720, deviceScaleFactor: 1 },
  { width: 1280, height: 720, deviceScaleFactor: 3 },
  { width: 1920, height: 1080, deviceScaleFactor: 1 },
  { width: 2560, height: 1440, deviceScaleFactor: 1 },
  { width: 3840, height: 2160, deviceScaleFactor: 1 },
] as const;

const STUB_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#1b4578"/></svg>`;

async function openDemoHome(page: Page) {
  await page.goto('/');
  await waitForAppReady(page);
  await page.getByRole('button', { name: /Get Started/i }).click();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Featured Live')).toBeVisible({ timeout: 30_000 });
}

interface CanvasMetrics {
  designPx: number;
  rootFont: number;
  railWidth: number;
  railItemWidth: number;
  heroLogoWidth: number;
  viewportWidth: number;
}

function readMetrics(page: Page): Promise<CanvasMetrics> {
  return page.evaluate(() => {
    const root = document.documentElement;
    const rootFont = Number.parseFloat(getComputedStyle(root).fontSize);
    const designPx = rootFont / 16;
    const rail = document.querySelector<HTMLElement>('[data-testid="navigation-rail"]');
    const railItem = rail?.querySelector<HTMLElement>('button');
    const hero = document.querySelector<HTMLElement>('img[data-logo-plate="hero"]');
    return {
      designPx,
      rootFont,
      railWidth: rail?.getBoundingClientRect().width ?? 0,
      railItemWidth: railItem?.getBoundingClientRect().width ?? 0,
      heroLogoWidth: hero?.getBoundingClientRect().width ?? 0,
      viewportWidth: window.innerWidth,
    };
  });
}

interface GridMetrics {
  columns: number;
  focusClipMargin: number;
  viewportWidth: number;
}

function readGridMetrics(page: Page): Promise<GridMetrics> {
  return page.evaluate(() => {
    const cards = Array.from(
      document.querySelectorAll<HTMLElement>('[data-testid="live-viewport"] [data-scroll-index]')
    );
    const tops = cards.map((card) => Math.round(card.getBoundingClientRect().top));
    const firstTop = tops.length > 0 ? Math.min(...tops) : 0;
    const columns = tops.filter((top) => Math.abs(top - firstTop) <= 2).length;
    const viewport = document.querySelector<HTMLElement>('[data-testid="live-viewport"]');
    return {
      columns,
      // Resolved to px by focusRingClipStyle because Chromium rejects calc()/
      // var() for overflow-clip-margin.
      focusClipMargin: Number.parseFloat(viewport?.style.overflowClipMargin ?? '') || 0,
      viewportWidth: viewport?.getBoundingClientRect().width ?? 0,
    };
  });
}

for (const canvas of CANVASES) {
  test(`${canvas.width}x${canvas.height} @${canvas.deviceScaleFactor}x is a proportional design render`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: canvas.width, height: canvas.height },
      deviceScaleFactor: canvas.deviceScaleFactor,
    });
    const page = await context.newPage();
    await page.route('**/upload.wikimedia.org/**', (route) =>
      route.fulfill({ status: 200, contentType: 'image/svg+xml', body: STUB_SVG })
    );

    try {
      await openDemoHome(page);

      const metrics = await readMetrics(page);
      // 16 design px per rem, from the same unit as the chrome.
      expect(Math.abs(metrics.rootFont - 16 * metrics.designPx)).toBeLessThanOrEqual(1);
      // The permanent rail and its hit target follow the design canvas.
      expect(Math.abs(metrics.railWidth - 96 * metrics.designPx)).toBeLessThanOrEqual(1);
      expect(Math.abs(metrics.railItemWidth - 64 * metrics.designPx)).toBeLessThanOrEqual(1);
      // Hero watermark is a token, not a literal.
      expect(Math.abs(metrics.heroLogoWidth - 256 * metrics.designPx)).toBeLessThanOrEqual(1);
      // The bug's headline symptom: rail was 7.5% of a 1280 canvas, now 5%.
      expect(metrics.railWidth / metrics.viewportWidth).toBeCloseTo(0.05, 2);

      await page.getByRole('button', { name: 'Live TV' }).click();
      await expect(page.getByTestId('live-viewport')).toBeVisible();
      await page.waitForTimeout(300);

      const grid = await readGridMetrics(page);
      // Six design columns at every canvas: the published maxColumns: 6.
      expect(grid.columns).toBe(6);
      expect(grid.viewportWidth).toBeGreaterThan(0);
      // The focus ring pad scales with the unit and remains the clip bound.
      expect(Math.abs(grid.focusClipMargin - 18 * metrics.designPx)).toBeLessThanOrEqual(1);

      // D-pad still works with proportional geometry.
      await page.keyboard.press('ArrowRight');
      await expect(page.locator('[data-focused="true"][data-channel-id]').first()).toBeVisible();
    } finally {
      await context.close();
    }
  });
}
