import { test, expect, type Page } from '@playwright/test';

/**
 * Chromium-only D-pad end-to-end coverage. Geometry-dependent navigation is
 * not testable in jsdom, so these specs use real arrow-key/Enter/Back presses.
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

function focusInRail(p: Page): Promise<boolean> {
  // Content cards are non-focusable divs, so `document.activeElement` can stay
  // on the last `<button>` (the rail) after logical focus moved into content.
  // The engine marks the real focus cursor with `data-focused="true"`.
  return p.evaluate(
    () => !!document.querySelector('[data-focused="true"]')?.closest('aside')
  );
}

async function activeElementState(p: Page) {
  return p.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    const rect = el?.getBoundingClientRect();
    const style = el ? getComputedStyle(el) : null;
    return {
      tag: el?.tagName ?? null,
      width: rect?.width ?? 0,
      height: rect?.height ?? 0,
      display: style?.display ?? null,
    };
  });
}

test('fresh install: onboarding -> demo import -> Home with D-pad only', async () => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Get Started/i })).toBeVisible();
  await page.keyboard.press('Enter');

  // Source grid: M3U has autoFocus; Local is below it, Demo to its right.
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');

  await expect(page.getByText('Featured Live')).toBeVisible({ timeout: 15_000 });
});

test('D-pad Right leaves the nav rail (BUG-001 regression)', async () => {
  await expect(page.getByText('Featured Live')).toBeVisible();

  for (let i = 0; i < 8 && !(await focusInRail(page)); i++) {
    await page.keyboard.press('ArrowLeft');
  }
  expect(await focusInRail(page)).toBe(true);

  await page.keyboard.press('ArrowRight');
  expect(await focusInRail(page)).toBe(false);
});

/**
 * Text and class of the spatial-navigation focus cursor. The engine marks the
 * focused node with `data-focused`; a node without `tv-focus-target` is a bare
 * layout container, which has no focus ring and swallows arrow presses
 * (BUG-020).
 */
function focusedCursor(p: Page) {
  return p.evaluate(() => {
    const el = document.querySelector('[data-focused="true"]') as HTMLElement | null;
    return {
      known: el !== null,
      isControl: el?.classList.contains('tv-focus-target') ?? false,
      text: (el?.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40),
    };
  });
}

test('every top-level screen can be traversed without focus dead ends', async () => {
  const navButtons = page.locator('aside button');
  const count = await navButtons.count();
  expect(count).toBeGreaterThan(0);

  const directions = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'] as const;

  for (let n = 0; n < count; n++) {
    await navButtons.nth(n).click();
    await page.waitForTimeout(150);

    // Screens with async data (EPG) settle their focus slightly later.
    await expect
      .poll(async () => (await focusedCursor(page)).isControl, { timeout: 5_000 })
      .toBe(true);

    for (let i = 0; i < 16; i++) {
      await page.keyboard.press(directions[i % directions.length]);
      const state = await activeElementState(page);
      expect(state.tag, `screen ${n}, step ${i}: focus fell to body`).not.toBe('BODY');
      expect(state.tag, `screen ${n}, step ${i}: focus lost`).not.toBeNull();
      expect(state.display, `screen ${n}, step ${i}: focus on hidden element`).not.toBe('none');

      // D-pad must always land on a real control (ring + activation), never on
      // a non-interactive card or a bare FocusZone container.
      const cursor = await focusedCursor(page);
      expect(cursor.known, `screen ${n}, step ${i}: no focused element`).toBe(true);
      expect(
        cursor.isControl,
        `screen ${n}, step ${i}: focus landed on a non-control "${cursor.text}"`
      ).toBe(true);
    }
  }
});

test('BACK exits the player back to the app shell', async () => {
  await navButtonsFirstClick(page);
  await page.getByRole('button', { name: /Watch Now/i }).click();

  await expect(page.locator('video')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.locator('video')).toBeHidden();
});

async function navButtonsFirstClick(p: Page) {
  await p.locator('aside button').first().click();
}
test('light theme renders a distinct light palette (light/dark regression)', async () => {
  const surfaceRgb = (p: Page) =>
    p.evaluate(() => getComputedStyle(document.body).backgroundColor);

  const parse = (rgb: string) => (rgb.match(/\d+/g) ?? []).slice(0, 3).map(Number);
  const luminance = (rgb: string) => {
    const [r, g, b] = parse(rgb);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  await page.goto('/');
  await page.locator('aside button').first().click();
  await expect(page.locator('html')).not.toHaveClass(/theme-light/);
  const dark = await surfaceRgb(page);

  // Persist the light theme the same way the settings store does, then reload.
  await page.evaluate(() => {
    const key = 'aether_iptv_settings_v1';
    const raw = JSON.parse(localStorage.getItem(key) ?? '{}');
    localStorage.setItem(key, JSON.stringify({ ...raw, theme: 'light' }));
  });
  await page.reload();

  await expect(page.locator('html')).toHaveClass(/theme-light/);
  const light = await surfaceRgb(page);

  expect(light).not.toBe(dark);
  expect(luminance(light), `light body background was ${light}`).toBeGreaterThan(200);
  expect(luminance(dark), `dark body background was ${dark}`).toBeLessThan(80);

  // Restore the default theme so later runs start clean.
  await page.evaluate(() => {
    const key = 'aether_iptv_settings_v1';
    const raw = JSON.parse(localStorage.getItem(key) ?? '{}');
    localStorage.setItem(key, JSON.stringify({ ...raw, theme: 'dark' }));
  });
  await page.reload();
});
