import { test, expect, type Page } from '@playwright/test';
import { waitForAppReady } from './helpers.ts';

/**
 * Home row snap: the row that holds focus must stay anchored on the focus line
 * and every focused card must stay fully inside the clip viewport (BUG-028).
 *
 * The regression this locks: the page scroller used to snap from a row-top cache
 * that was measured once at mount. Two transitions this screen really has broke
 * it — the hero collapsing when focus leaves it, and the watch-history row being
 * inserted above the focused row once `getRecentWatchHistory()` resolved — and on
 * a TV WebView without `ResizeObserver` (older than Chromium 64) nothing ever
 * re-measured, so the focused row was painted above the clip viewport with only
 * its bottom half on screen.
 *
 * Geometry-only assertions, so this lives in Playwright rather than jsdom.
 */
test.describe.configure({ mode: 'serial' });

const FOCUS_LINE = 0.38;

function buildPlaylist(count: number): string {
  const lines = ['#EXTM3U'];
  for (let i = 1; i <= count; i += 1) {
    lines.push(`#EXTINF:-1 tvg-id="h${i}" group-title="Group ${i % 40}",Channel ${i}`);
    lines.push('https://example.com/stream/1.ts');
  }
  return lines.join('\n');
}

async function importPlaylist(page: Page): Promise<void> {
  await page.route('**/home-rows.m3u', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/vnd.apple.mpegurl',
      body: buildPlaylist(60),
    })
  );
  await page.goto('/');
  await page.getByRole('button', { name: /Get Started/i }).click();
  await page.getByText('M3U / M3U8 URL').click();
  await page.keyboard.press('ArrowDown'); // Name -> URL field
  await page.keyboard.press('Enter'); // focus the DOM input
  await page.keyboard.type('http://localhost:3000/home-rows.m3u');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Featured Live')).toBeVisible({ timeout: 45_000 });
  await waitForAppReady(page);
}

/** Opens the player twice so Home renders a "Recently Watched" row. */
async function seedWatchHistory(page: Page): Promise<void> {
  for (let i = 0; i < 2; i += 1) {
    await page.keyboard.press('ArrowRight'); // hero actions -> first row
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(300);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1_000);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await page.keyboard.press('Escape');
      if (await page.locator('video').isHidden()) break;
      await page.waitForTimeout(300);
    }
    await page.waitForTimeout(500);
  }
}

interface RowSnapGeometry {
  /** Row index reported by the focused element's `data-scroll-row` ancestor. */
  row: number | null;
  /** Focused row's top, relative to the clip viewport's top edge. */
  rowViewportTop: number | null;
  /** Where the focus-line rule puts that top (clamped at both ends). */
  expectedRowViewportTop: number | null;
  focusedTop: number;
  focusedBottom: number;
  viewportTop: number;
  viewportBottom: number;
  offset: number;
  expectedOffset: number;
  /** Design-pixel factor; geometry tolerance scales with it (ADR 035). */
  designPx: number;
}

function rowSnapGeometry(page: Page): Promise<RowSnapGeometry | null> {
  return page.evaluate(() => {
    const viewport = document.querySelector('[data-testid="home-viewport"]') as HTMLElement | null;
    const focused = document.querySelector('[data-focused="true"]') as HTMLElement | null;
    if (!viewport || !focused) return null;

    const rowEl = focused.closest('[data-scroll-row]') as HTMLElement | null;
    const viewportSize = Number(viewport.getAttribute('data-scroll-viewport-size'));
    const contentSize = Number(viewport.getAttribute('data-scroll-content-size'));
    const offset = Number(viewport.getAttribute('data-scroll-offset'));
    const rowTop = rowEl?.offsetTop ?? null;
    const focusLine = 0.38;
    const maxOffset = Math.max(0, contentSize - viewportSize);
    const expectedOffset =
      rowTop === null ? 0 : Math.min(Math.max(rowTop - focusLine * viewportSize, 0), maxOffset);
    const viewportRect = viewport.getBoundingClientRect();
    const focusedRect = focused.getBoundingClientRect();
    const rowRect = rowEl?.getBoundingClientRect() ?? null;

    return {
      row: rowEl?.dataset.scrollRow !== undefined ? Number(rowEl.dataset.scrollRow) : null,
      rowViewportTop: rowRect ? rowRect.top - viewportRect.top : null,
      expectedRowViewportTop:
        rowTop === null ? null : rowTop - expectedOffset,
      focusedTop: focusedRect.top,
      focusedBottom: focusedRect.bottom,
      viewportTop: viewportRect.top,
      viewportBottom: viewportRect.bottom,
      offset,
      expectedOffset,
      designPx: Number.parseFloat(getComputedStyle(document.documentElement).fontSize) / 16,
    };
  });
}

/**
 * The focused row must sit on the focus line (or at the clamped end of the
 * list), and the focused card must be painted entirely inside the viewport.
 */
async function expectFocusedRowAnchored(page: Page, label: string): Promise<void> {
  await expect
    .poll(
      async () => {
        const geo = await rowSnapGeometry(page);
        if (!geo) return 'no-focus';
        if (geo.rowViewportTop === null || geo.expectedRowViewportTop === null) return 'no-row';
        // A 4K canvas paints at 2x, so the same sub-pixel layout drift is 2x
        // larger in CSS px. Keep the tolerance proportional to the design unit
        // instead of relaxing it to a flat physical number.
        const tolerance = Math.max(2, 2 * geo.designPx);
        const rowDrift = Math.abs(geo.rowViewportTop - geo.expectedRowViewportTop);
        const inside =
          geo.focusedTop >= geo.viewportTop - tolerance &&
          geo.focusedBottom <= geo.viewportBottom + tolerance;
        return rowDrift <= tolerance && inside
          ? 'ok'
          : `row=${geo.row} rowTopInViewport=${Math.round(
              geo.rowViewportTop
            )} expected=${Math.round(geo.expectedRowViewportTop)} focus=${Math.round(
              geo.focusedTop
            )}..${Math.round(geo.focusedBottom)} clip=${Math.round(geo.viewportTop)}..${Math.round(
              geo.viewportBottom
            )}`;
      },
      { timeout: 5_000, message: label }
    )
    .toBe('ok');
}

test('TV WebView without ResizeObserver: focused Home row stays on the focus line', async ({
  browser,
}) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  // Emulates the WebView of an older TV (Chromium < 64), where every observer
  // based re-measure silently disappears.
  await page.addInitScript(() => {
    delete (window as unknown as Record<string, unknown>).ResizeObserver;
  });
  await importPlaylist(page);
  await seedWatchHistory(page);

  // Leave and re-enter Home: the watch-history row is inserted above the fold
  // asynchronously while the hero expands/collapses, which is exactly the
  // layout shift that used to leave the cache stale.
  const nav = page.locator('aside button');
  await nav.nth(1).click();
  await page.waitForTimeout(1_200);
  await nav.nth(0).click();
  await expect(page.getByText('Featured Live')).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(1_000);

  await page.keyboard.press('ArrowRight');
  for (let i = 0; i < 4; i += 1) {
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(800);
    await expectFocusedRowAnchored(page, `home row ${i + 1} without ResizeObserver`);
  }

  await context.close();
});

test('focused Home row stays anchored when the viewport (focus line) changes', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  await importPlaylist(page);
  await seedWatchHistory(page);
  await page.reload();
  await waitForAppReady(page);
  await expect(page.getByText('Featured Live')).toBeVisible({ timeout: 15_000 });

  await page.keyboard.press('ArrowRight');
  for (let i = 0; i < 3; i += 1) {
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(600);
  }
  await expectFocusedRowAnchored(page, '1080p');

  for (const [width, height] of [
    [1280, 720],
    [3840, 2160],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(600);
    await expectFocusedRowAnchored(page, `${width}x${height}`);
  }

  await context.close();
});
