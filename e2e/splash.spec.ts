import { test, expect, type Page } from '@playwright/test';
import { waitForAppReady } from './helpers.ts';

/**
 * Cold-boot splash coverage. Only a real browser can prove the parts that
 * matter here: that the served HTML paints the mark before any script runs,
 * that React replaces that markup, and that the shell never appears behind the
 * splash with no data in it.
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

test('the served HTML carries the splash, so the pre-React paint is never blank', async ({
  request,
}) => {
  const html = await (await request.get('/')).text();

  expect(html).toContain('class="boot-splash"');
  expect(html).toContain('role="status"');
  // Rendered without the bundled stylesheet, which arrives with the module.
  expect(html).toContain('--brand-mark-size');
});

test('hands the static splash over to React, then clears it into onboarding', async () => {
  await page.goto('/');

  const splash = page.getByTestId('app-splash');
  await expect(splash).toBeVisible();

  // React replaced the static copy instead of stacking on top of it: exactly
  // one splash exists, and it is the app's.
  expect(await page.locator('.boot-splash').count()).toBe(0);

  // The shell is not mounted behind the splash.
  expect(await page.getByText('Featured Live').count()).toBe(0);

  // …and React paints the mark without a network round trip.
  const mark = splash.locator('img');
  await expect(mark).toBeVisible();
  expect(await mark.getAttribute('src')).toContain('svg');

  await waitForAppReady(page);
  await expect(page.getByRole('button', { name: /Get Started/i })).toBeVisible();
});

test('a reload with saved data shows the splash again, then Home', async () => {
  // Onboarding -> demo import, the same D-pad path the other specs use.
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Featured Live')).toBeVisible({ timeout: 15_000 });

  await page.reload();

  // The same splash covers a reload that has data to load — Dexie open and the
  // schema migration run behind it. That the shell is not already mounted
  // underneath is asserted deterministically in src/App.test.tsx, where the
  // fade cannot overtake the assertion.
  await expect(page.getByTestId('app-splash')).toBeVisible();

  await waitForAppReady(page);
  await expect(page.getByTestId('navigation-rail')).toBeVisible();
  await expect(page.getByText('Featured Live')).toBeVisible({ timeout: 15_000 });
});
