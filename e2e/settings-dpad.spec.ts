import { test, expect, type Page } from '@playwright/test';

/**
 * Geometry-dependent D-pad coverage for the Settings screen (BUG-020).
 *
 * The screen used to be a dead end: its non-interactive cards were registered
 * as focus stops (with no ring, because the ring is only styled for interactive
 * cards) and every styled tile was a plain `<button>` the spatial-navigation
 * engine had never been told about. These specs drive the screen with real
 * arrow/Enter presses and assert focus always lands on a real, ringed control.
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

/** Text/class/position of the spatial-navigation focus cursor. */
function focused(p: Page) {
  return p.evaluate(() => {
    const el = document.querySelector('[data-focused="true"]') as HTMLElement | null;
    return {
      text: (el?.textContent ?? '').trim().replace(/\s+/g, ' '),
      label: el?.getAttribute('aria-label') ?? '',
      isFocusTarget: el?.classList.contains('tv-focus-target') ?? false,
      insideRail: !!el?.closest('[data-testid="navigation-rail"]'),
    };
  });
}

/** Every D-pad stop must be a control, never a plain layout container. */
async function expectFocusOnControl(p: Page, expected: RegExp) {
  const state = await focused(p);
  expect(state.isFocusTarget, `focus landed on a non-control: "${state.text}"`).toBe(true);
  expect(state.text, `unexpected focus target: "${state.text}"`).toMatch(expected);
}

async function focusRailSettings(p: Page) {
  for (let i = 0; i < 10; i++) {
    const state = await focused(p);
    if (state.insideRail && state.label === 'Settings') return;
    await p.keyboard.press(state.insideRail ? 'ArrowDown' : 'ArrowLeft');
  }
  throw new Error('could not focus the Settings destination in the rail');
}

async function openSettings(p: Page, viaDpad: boolean) {
  await p.goto('/');
  const getStarted = p.getByRole('button', { name: /Get Started/i });
  if (await getStarted.isVisible().catch(() => false)) {
    await p.keyboard.press('Enter');
    await p.keyboard.press('ArrowDown');
    await p.keyboard.press('ArrowRight');
    await p.keyboard.press('Enter');
    await p.waitForTimeout(2000);
  }

  if (viaDpad) {
    await focusRailSettings(p);
    await p.keyboard.press('Enter');
  } else {
    await p.getByRole('button', { name: 'Settings' }).click();
  }

  await expect(p.getByText('Settings & Configuration')).toBeVisible();
}

test('D-pad enters settings from the rail and lands on a control', async () => {
  await openSettings(page, true);
  await expectFocusOnControl(page, /Appearance & TV Safe Area/);
});

test('D-pad walks every section of the Appearance panel', async () => {
  await openSettings(page, false);
  await expectFocusOnControl(page, /Appearance & TV Safe Area/);

  await page.keyboard.press('ArrowDown');
  await expectFocusOnControl(page, /Dark Mode/);

  await page.keyboard.press('ArrowRight');
  await expectFocusOnControl(page, /AMOLED/);

  await page.keyboard.press('ArrowDown');
  await expectFocusOnControl(page, /Safe Padding/);

  await page.keyboard.press('ArrowDown');
  await expectFocusOnControl(page, /Remote Hints/);

  await page.keyboard.press('ArrowDown');
  await expectFocusOnControl(page, /90%/);

  // RIGHT stays inside the focused section's row.
  await page.keyboard.press('ArrowRight');
  await expectFocusOnControl(page, /100%/);

  // ...and does not leak into the flat tab row when the row ends.
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expectFocusOnControl(page, /125%/);
});

test('OK switches panels and activates the focused tile', async () => {
  await openSettings(page, false);

  await page.keyboard.press('ArrowRight');
  await expectFocusOnControl(page, /Playback & Engines/);
  await page.keyboard.press('Enter');
  await expect(page.getByText('Default Playback Engine')).toBeVisible();

  await page.keyboard.press('ArrowDown');
  await expectFocusOnControl(page, /Auto \(Recommended\)/);

  await page.keyboard.press('ArrowRight');
  await expectFocusOnControl(page, /HLS\.js Engine/);
  await page.keyboard.press('Enter');

  const engine = await page.evaluate(() => {
    const raw = localStorage.getItem('aether_iptv_settings_v1');
    return raw ? (JSON.parse(raw).defaultEngine as string) : null;
  });
  expect(engine).toBe('hls');
});

test('OK applies a theme tile', async () => {
  await openSettings(page, false);

  await page.keyboard.press('ArrowDown');
  await expectFocusOnControl(page, /Dark Mode/);
  await page.keyboard.press('ArrowRight');
  await expectFocusOnControl(page, /AMOLED/);
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveClass(/theme-amoled/);
});
