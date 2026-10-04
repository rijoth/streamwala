import { test, expect, type Page } from '@playwright/test';

/**
 * Focus-driven scrolling coverage on a large (10k channel) playlist.
 *
 * Uses a routed M3U so the app imports a deterministic fixture through its real
 * onboarding path. Requires a real browser: jsdom has no geometry.
 */
test.describe.configure({ mode: 'serial' });

const CHANNEL_COUNT = 10_000;

function buildPlaylist(count: number): string {
  const lines = ['#EXTM3U'];
  for (let i = 1; i <= count; i += 1) {
    lines.push(`#EXTINF:-1 tvg-id="ch${i}" group-title="Group ${i % 24}",Channel ${i}`);
    lines.push(`https://example.com/stream/${i}.ts`);
  }
  return lines.join('\n');
}

let page: Page;

async function openHomeWithLargePlaylist(p: Page) {
  await p.route('**/large.m3u', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/vnd.apple.mpegurl',
      body: buildPlaylist(CHANNEL_COUNT),
    })
  );
  await p.goto('/');
  await p.getByRole('button', { name: /Get Started/i }).click();
  await p.getByText('M3U / M3U8 URL').click();
  await p.keyboard.press('ArrowDown'); // Name -> URL field
  await p.keyboard.press('Enter'); // focus the DOM input
  await p.keyboard.type('http://localhost:3000/large.m3u');
  await p.keyboard.press('Enter'); // submit import
  await expect(p.getByText('Featured Live')).toBeVisible({ timeout: 45_000 });
}

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  page = await context.newPage();
  await openHomeWithLargePlaylist(page);
});

test.afterAll(async () => {
  await page.context().close();
});

interface FocusGeometry {
  left: number;
  top: number;
  right: number;
  bottom: number;
  clip: { left: number; top: number; right: number; bottom: number };
  rowTop: number | null;
  clipHeight: number;
  offset: number | null;
}

/** Geometry of the focused element, its nearest clipping ancestor and the row. */
function focusGeometry(p: Page): Promise<FocusGeometry | null> {
  return p.evaluate(() => {
    const el = document.querySelector('[data-focused="true"]') as HTMLElement | null;
    if (!el) return null;
    const r = el.getBoundingClientRect();

    let clip = { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
    let parent = el.parentElement;
    while (parent) {
      const style = getComputedStyle(parent);
      const overflow = `${style.overflow}${style.overflowX}${style.overflowY}`;
      if (/hidden|auto|scroll|clip/.test(overflow)) {
        const pr = parent.getBoundingClientRect();
        clip = { left: pr.left, top: pr.top, right: pr.right, bottom: pr.bottom };
        break;
      }
      parent = parent.parentElement;
    }

    const row = el.closest('[data-scroll-row]') as HTMLElement | null;
    const viewport = document.querySelector('[data-scroll-axis="vertical"]') as HTMLElement | null;
    return {
      left: r.left,
      top: r.top,
      right: r.right,
      bottom: r.bottom,
      clip,
      rowTop: row ? row.getBoundingClientRect().top : null,
      clipHeight: clip.bottom - clip.top,
      offset: viewport ? Number(viewport.getAttribute('data-scroll-offset')) : null,
    };
  });
}

async function expectFocusedFullyVisible(p: Page, label: string) {
  await expect
    .poll(
      async () => {
        const geo = await focusGeometry(p);
        if (!geo) return 'no-focus';
        const ringPad = 4;
        const inside =
          geo.left - ringPad >= geo.clip.left - 2 &&
          geo.right + ringPad <= geo.clip.right + 2 &&
          geo.top - ringPad >= geo.clip.top - 2 &&
          geo.bottom + ringPad <= geo.clip.bottom + 2;
        return inside ? 'ok' : `left=${Math.round(geo.left)} clip=${JSON.stringify(geo.clip)}`;
      },
      { timeout: 4_000, message: label }
    )
    .toBe('ok');
}

async function holdArrowDown(p: Page, ms: number) {
  await p.evaluate(async (duration) => {
    const fire = (repeat: boolean) => {
      const event = new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        code: 'ArrowDown',
        repeat,
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, 'keyCode', { get: () => 40 });
      window.dispatchEvent(event);
    };
    const start = performance.now();
    fire(false);
    while (performance.now() - start < duration) {
      await new Promise((resolve) => setTimeout(resolve, 30));
      fire(true);
    }
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowDown', code: 'ArrowDown', bubbles: true }));
  }, ms);
}

async function focusCursor(p: Page) {
  return p.evaluate(() => {
    const el = document.querySelector('[data-focused="true"]') as HTMLElement | null;
    return {
      text: (el?.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40),
      isControl: el?.classList.contains('tv-focus-target') ?? false,
    };
  });
}

test('Home row snap keeps focus on the focus line and toggles the hero', async () => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.locator('aside button').first().click();
  await expect(page.getByText('Featured Live')).toBeVisible({ timeout: 10_000 });

  // Move from the hero into a content row.
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('[data-hero-state="collapsed"]')).toBeVisible();
  await expectFocusedFullyVisible(page, 'home content row');

  // Returning to the hero restores it fully.
  for (let i = 0; i < 6; i += 1) {
    await page.keyboard.press('ArrowUp');
    if (await page.locator('[data-hero-state="expanded"]').isVisible()) break;
  }
  await expect(page.locator('[data-hero-state="expanded"]')).toBeVisible();
  await page.setViewportSize({ width: 1920, height: 1080 });
});

test('10k channel list: held Down settles aligned and in view', async () => {
  await page.getByRole('button', { name: 'Live TV' }).click();
  await expect(page.getByText('All Channels').first()).toBeVisible();
  await page.waitForTimeout(200);

  await page.keyboard.press('ArrowDown'); // chips -> first grid card
  await holdArrowDown(page, 3000);

  // Let the release tween settle, then assert no further motion.
  await page.waitForTimeout(400);
  const after1 = await focusGeometry(page);
  await page.waitForTimeout(250);
  const after2 = await focusGeometry(page);

  expect(after1?.offset).not.toBeNull();
  expect(after2?.offset).toBe(after1?.offset);
  expect(after2!.offset!, 'hold should have scrolled').toBeGreaterThan(0);
  await expectFocusedFullyVisible(page, 'channel list after hold');
  expect((await focusCursor(page)).isControl).toBe(true);
});

test('returning from the player restores the exact card and offset', async () => {
  await expectFocusedFullyVisible(page, 'before play');
  const before = await page.evaluate(() => {
    const el = document.querySelector('[data-focused="true"]') as HTMLElement | null;
    const viewport = document.querySelector('[data-scroll-axis="vertical"]') as HTMLElement | null;
    return {
      text: (el?.textContent ?? '').trim(),
      offset: viewport ? Number(viewport.getAttribute('data-scroll-offset')) : 0,
    };
  });

  await page.keyboard.press('Enter');
  await expect(page.locator('video')).toBeVisible({ timeout: 10_000 });
  for (let i = 0; i < 3; i += 1) {
    await page.keyboard.press('Escape');
    if (await page.locator('video').isHidden()) break;
  }
  await expect(page.locator('video')).toBeHidden();

  await expect(page.getByText('All Channels').first()).toBeVisible({ timeout: 10_000 });
  const after = await page.evaluate(() => {
    const el = document.querySelector('[data-focused="true"]') as HTMLElement | null;
    const viewport = document.querySelector('[data-scroll-axis="vertical"]') as HTMLElement | null;
    return {
      text: (el?.textContent ?? '').trim(),
      offset: viewport ? Number(viewport.getAttribute('data-scroll-offset')) : 0,
    };
  });
  expect(after.text).toBe(before.text);
  expect(after.offset).toBe(before.offset);
});

test('focused item stays visible at 720p, 1080p and 4K', async () => {
  for (const [width, height] of [
    [1280, 720],
    [1920, 1080],
    [3840, 2160],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.locator('aside button').nth(0).click(); // Home
    await page.waitForTimeout(200);
    await page.locator('aside button').nth(1).click(); // Live TV
    await page.waitForTimeout(400);
    for (const key of ['ArrowDown', 'ArrowRight', 'ArrowDown', 'ArrowLeft']) {
      await page.keyboard.press(key);
      await expectFocusedFullyVisible(page, `live ${width}x${height} after ${key}`);
    }
  }
});

test('held-key traversal stays responsive under 4x CPU throttling', async () => {
  const client = await page.context().newCDPSession(page);
  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  try {
    await page.getByRole('button', { name: 'Live TV' }).click();
    await page.waitForTimeout(300);
    await page.keyboard.press('ArrowDown'); // chips -> grid
    await page.waitForTimeout(300);

    const result = await page.evaluate(async () => {
      const handlerDurations: number[] = [];
      const before = document.querySelector('[data-scroll-index]')?.getAttribute('data-scroll-index');
      const focusedBefore = document.querySelector('[data-focused="true"]')?.getAttribute('data-focus-key') ?? null;

      const fire = (repeat: boolean) => {
        const event = new KeyboardEvent('keydown', {
          key: 'ArrowDown',
          code: 'ArrowDown',
          repeat,
          bubbles: true,
          cancelable: true,
        });
        Object.defineProperty(event, 'keyCode', { get: () => 40 });
        const start = performance.now();
        window.dispatchEvent(event);
        const elapsed = performance.now() - start;
        if (repeat) handlerDurations.push(elapsed);
      };

      const start = performance.now();
      fire(false);
      while (performance.now() - start < 1500) {
        await new Promise((resolve) => setTimeout(resolve, 30));
        fire(true);
      }
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowDown', code: 'ArrowDown', bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 500));
      return { handlerDurations, before, focusedBefore };
    });

    const sorted = result.handlerDurations.slice().sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
    // Documented budget for the synchronous focus + render work of one repeat
    // under 4x CPU throttling. Frame cadence itself is environment-bound in
    // headless Chromium, so the app's own handler cost is the meaningful signal.
    expect(result.handlerDurations.length, 'held key produced repeats').toBeGreaterThan(4);
    expect(p95, `p95 key-handler was ${p95.toFixed(1)}ms (budget 100ms)`).toBeLessThan(100);
  } finally {
    await client.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  }
});
