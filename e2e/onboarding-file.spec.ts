import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Local-file onboarding must be completable with the remote alone.
 *
 * Regression: the file source rendered `<label for>` on a hidden
 * `<input type="file">`, which the spatial-navigation engine cannot see, so the
 * picker (and therefore the whole screen) was mouse-only. Geometry-dependent
 * moves between the name field, the picker and the action row need a real
 * browser, so they live here.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const PLAYLIST_FIXTURE = path.join(here, '../src/test/fixtures/epg/messy-playlist.m3u');

test.describe.configure({ mode: 'serial' });

let page: Page;

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  page = await context.newPage();
});

test.afterAll(async () => {
  await page.context().close();
});

/** Text of the engine's focus cursor (`data-focused` marks the real cursor). */
function focusedText(p: Page): Promise<string> {
  return p.evaluate(
    () =>
      (document.querySelector('[data-focused="true"]')?.textContent ?? '')
        .trim()
        .replace(/\s+/g, ' ')
  );
}

test('local M3U import: D-pad reaches the picker, remote OK opens the chooser', async () => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Get Started/i })).toBeVisible();
  await page.keyboard.press('Enter');

  // Source grid: M3U is auto-focused, Local M3U File sits directly below it.
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Select Local M3U File')).toBeVisible();

  // The picker owns focus on entry — no dead screen, no mouse needed.
  await expect
    .poll(() => focusedText(page), { timeout: 5_000 })
    .toMatch(/Press OK to choose M3U \/ M3U8 file/);

  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.keyboard.press('Enter'),
  ]);
  await chooser.setFiles(PLAYLIST_FIXTURE);

  await expect(page.getByTestId('onboarding-file-picker')).toContainText('messy-playlist.m3u');
  await expect(page.getByTestId('onboarding-file-picker')).toContainText(/KB ready/);

  // Action row below the picker: walk Right until the primary action is focused.
  await page.keyboard.press('ArrowDown');
  for (let i = 0; i < 3 && !/Start Import/.test(await focusedText(page)); i++) {
    await page.keyboard.press('ArrowRight');
  }
  await expect.poll(() => focusedText(page)).toMatch(/Start Import/);

  await page.keyboard.press('Enter');

  // Import runs from the remote press and lands on Home.
  await expect(page.getByText('Featured Live')).toBeVisible({ timeout: 20_000 });
});
