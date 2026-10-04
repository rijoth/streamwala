import { test, expect, type Page } from '@playwright/test';

/**
 * Geometry-dependent D-pad coverage for the permanent icon-only navigation
 * rail. Requires a real browser: jsdom reports 0x0 rects, so spatial
 * navigation and the rail/content overlap check cannot run in Vitest.
 */
test.describe.configure({ mode: 'serial' });

let page: Page;

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  page = await context.newPage();
});

test.afterAll(async () => {
  await page.context().close();
});

/**
 * Reads the spatial-navigation focus cursor. Content cards are non-focusable
 * `<div>`s, so `document.activeElement` can stay on the last real `<button>`
 * (the rail) even after logical focus moved into content — the engine marks its
 * current node with `data-focused="true"` instead.
 */
function focusedState(p: Page) {
  return p.evaluate(() => {
    const el = document.querySelector('[data-focused="true"]');
    return {
      inRail: !!el?.closest('[data-testid="navigation-rail"]'),
      label: el?.getAttribute('aria-label') ?? null,
      text: el?.textContent?.trim() ?? null,
    };
  });
}

test('fresh install reaches Home with D-pad only', async () => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Get Started/i })).toBeVisible();
  await page.keyboard.press('Enter');

  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');

  await expect(page.getByText('Featured Live')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('navigation-rail')).toBeVisible();
});

test('rail and content never overlap at 720p, 1080p and 4K', async () => {
  await page.goto('/');
  await expect(page.getByText('Featured Live')).toBeVisible({ timeout: 15_000 });

  for (const [width, height] of [
    [1280, 720],
    [1920, 1080],
    [3840, 2160],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(150);

    const rail = await page.getByTestId('navigation-rail').boundingBox();
    const main = await page.locator('main').boundingBox();
    expect(rail, `rail missing at ${width}x${height}`).not.toBeNull();
    expect(main, `content missing at ${width}x${height}`).not.toBeNull();

    const railRight = rail!.x + rail!.width;
    expect(main!.x, `content overlaps the rail at ${width}x${height}`).toBeGreaterThanOrEqual(
      railRight - 1
    );

    const position = await page
      .getByTestId('navigation-rail')
      .evaluate((el) => getComputedStyle(el).position);
    expect(position, 'rail must stay in normal layout flow').not.toBe('fixed');

    // The hero primary action must sit fully to the right of the rail.
    const watchNow = await page.getByRole('button', { name: /Watch Now/i }).boundingBox();
    expect(watchNow, `Watch Now missing at ${width}x${height}`).not.toBeNull();
    expect(watchNow!.x).toBeGreaterThanOrEqual(railRight - 1);
  }
});

test('LEFT enters the rail on the active destination', async () => {
  await page.goto('/');
  await expect(page.getByText('Featured Live')).toBeVisible({ timeout: 15_000 });

  for (let i = 0; i < 8; i++) {
    if ((await focusedState(page)).inRail) break;
    await page.keyboard.press('ArrowLeft');
  }

  const state = await focusedState(page);
  expect(state.inRail).toBe(true);
  expect(state.label).toBe('Home');
  await expect(page.getByRole('button', { name: 'Home' })).toHaveAttribute(
    'aria-current',
    'page'
  );
});

test('UP and DOWN stop at the rail ends without leaking into content', async () => {
  await page.goto('/');
  await expect(page.getByText('Featured Live')).toBeVisible({ timeout: 15_000 });

  for (let i = 0; i < 8; i++) {
    if ((await focusedState(page)).inRail) break;
    await page.keyboard.press('ArrowLeft');
  }
  expect((await focusedState(page)).inRail).toBe(true);

  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowUp');
  expect(await focusedState(page)).toMatchObject({ inRail: true, label: 'Home' });

  for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowDown');
  expect(await focusedState(page)).toMatchObject({ inRail: true, label: 'Settings' });
});

test('OK navigates and lands focus in the new screen content', async () => {
  await page.goto('/');
  await expect(page.getByText('Featured Live')).toBeVisible({ timeout: 15_000 });

  for (let i = 0; i < 8; i++) {
    if ((await focusedState(page)).inRail) break;
    await page.keyboard.press('ArrowLeft');
  }
  await page.keyboard.press('ArrowDown');
  expect((await focusedState(page)).label).toBe('Live TV');

  await page.keyboard.press('Enter');

  await expect(page.getByRole('button', { name: 'Live TV' })).toHaveAttribute(
    'aria-current',
    'page'
  );
  await expect.poll(async () => (await focusedState(page)).inRail).toBe(false);
});

test('RIGHT restores the previously focused content element', async () => {
  await page.goto('/');
  await expect(page.getByText('Featured Live')).toBeVisible({ timeout: 15_000 });

  // Navigation is now transform-animated, so wait for the focus marker to
  // settle after each press before reading it.
  const settle = () => page.waitForTimeout(250);

  // Move into a horizontal content row, remembering the exact element that was
  // focused on the press that entered the rail.
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await settle();

  let before: string | null = null;
  for (let i = 0; i < 8; i++) {
    const state = await focusedState(page);
    if (state.inRail) break;
    before = state.text;
    await page.keyboard.press('ArrowLeft');
    await settle();
  }
  expect((await focusedState(page)).inRail).toBe(true);
  expect(before).not.toBeNull();

  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await focusedState(page)).inRail).toBe(false);
  expect((await focusedState(page)).text).toBe(before);
});
