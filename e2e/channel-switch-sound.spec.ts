import { test, expect, type Page } from '@playwright/test';

/**
 * Channel-switch tone (ADR 025).
 *
 * The tone is a Web Audio graph with no DOM to inspect, and a real
 * `AudioContext` in headless Chromium is not deterministic. Before any app code
 * runs, the page is given a counting stand-in for `AudioContext`; the specs then
 * assert exactly how many tones were played for each way a channel becomes
 * active. This is the regression guard for the reported bug: selecting a
 * channel card (a fresh `PlayerView` mount) played no tone.
 *
 * The counter is reset on every navigation by `addInitScript`, and the specs run
 * serially because they share one page and the Settings preference persists in
 * `localStorage`.
 */

test.describe.configure({ mode: 'serial' });

let page: Page;

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  page = await context.newPage();
  await page.addInitScript(() => {
    const w = window as unknown as { __switchTones: number; AudioContext: unknown };
    w.__switchTones = 0;

    class FakeAudioContext {
      state = 'running';
      currentTime = 0;
      destination = {};
      resume() {
        this.state = 'running';
        return Promise.resolve();
      }
      createOscillator() {
        return {
          type: 'sine',
          frequency: {
            setValueAtTime() {},
            exponentialRampToValueAtTime() {},
          },
          connect() {},
          disconnect() {},
          stop() {},
          addEventListener() {},
          start() {
            w.__switchTones += 1;
          },
        };
      }
      createGain() {
        return {
          gain: {
            setValueAtTime() {},
            exponentialRampToValueAtTime() {},
          },
          connect() {},
          disconnect() {},
        };
      }
    }

    w.AudioContext = FakeAudioContext;
  });
});

test.afterAll(async () => {
  await page.context().close();
});

const tones = () => page.evaluate(() => (window as unknown as { __switchTones: number }).__switchTones);

/** First-run onboarding -> demo import -> Home, with D-pad only. */
async function bootFirstRun() {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Get Started/i })).toBeVisible();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Featured Live')).toBeVisible({ timeout: 15_000 });
}

test('tuning in and zapping each play exactly one tone', async () => {
  await bootFirstRun();

  await page.getByRole('button', { name: /Watch Now/i }).click();
  await expect(page.locator('video')).toBeVisible();
  await expect.poll(tones).toBe(1);

  await page.keyboard.press('ArrowUp');
  await expect.poll(tones).toBe(2);

  await page.keyboard.press('ArrowDown');
  await expect.poll(tones).toBe(3);
});

test('selecting a channel card from the Live TV grid plays the tone', async () => {
  await page.goto('/');
  await expect(page.getByText('Featured Live')).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: /^Live/i }).click();
  const cards = page.locator('[data-scroll-index]');
  await expect(cards.first()).toBeVisible();

  // A fresh PlayerView mount is a tune-in, not a silent no-op.
  await cards.nth(2).click();
  await expect(page.locator('video')).toBeVisible();
  await expect.poll(tones).toBe(1);
});

test('disabling the preference keeps channel switching silent', async () => {
  await page.goto('/');
  await expect(page.getByText('Featured Live')).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: /Settings/i }).click();
  await page.getByRole('button', { name: /Playback & Engines/i }).click();
  await page.getByRole('button', { name: 'Switch Sound On' }).click();
  await expect(page.getByRole('button', { name: 'Switch Sound Off' })).toBeVisible();

  await page.getByRole('button', { name: /^Live/i }).click();
  const cards = page.locator('[data-scroll-index]');
  await expect(cards.first()).toBeVisible();
  await cards.nth(3).click();
  await expect(page.locator('video')).toBeVisible();

  await page.waitForTimeout(500);
  expect(await tones()).toBe(0);
});
