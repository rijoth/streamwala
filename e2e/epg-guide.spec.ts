import { test, expect, type Page } from '@playwright/test';

/**
 * D-pad-only EPG guide traversal with a seeded 20k-programme playlist. The
 * guide is virtualized on both axes, so these specs assert the focused cell is
 * fully visible/unclipped and that traversal stays responsive under 4x CPU
 * throttling. IndexedDB is seeded directly (the import/typing flow is covered
 * by jsdom component tests).
 */
test.describe.configure({ mode: 'serial' });

let page: Page;

async function seedGuide(channelCount: number, programsPerChannel: number) {
  await page.evaluate(
    ({ channels, perChannel }) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('AetherIptvDatabase');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const stores = [
            'playlists',
            'channels',
            'groups',
            'epgSources',
            'epgChannels',
            'epgMappings',
            'programs',
          ];
          const tx = db.transaction(stores, 'readwrite');
          const now = Date.now();
          const dayStart = new Date();
          dayStart.setHours(0, 0, 0, 0);
          const dayStartMs = dayStart.getTime();

          const playlistStore = tx.objectStore('playlists');
          const existing = playlistStore.getAll();
          existing.onsuccess = () => {
            for (const row of existing.result as Array<{ id: string }>) {
              playlistStore.put({ ...row, isActive: false });
            }
          };
          playlistStore.put({
            id: 'e2e_pl',
            name: 'E2E Playlist',
            type: 'm3u',
            createdAt: now,
            lastSyncedAt: now,
            channelCount: channels,
            isActive: true,
          });

          const channelStore = tx.objectStore('channels');
          const programStore = tx.objectStore('programs');
          for (let c = 0; c < channels; c++) {
            channelStore.put({
              id: `e2e_ch_${c}`,
              playlistId: 'e2e_pl',
              name: `E2E Channel ${c}`,
              groupId: 'e2e_g',
              groupName: 'E2E',
              streamUrl: 'https://example.invalid/s.m3u8',
              tvgId: `e2e.${c}`,
              number: c + 1,
              isFavorite: false,
              isHidden: false,
              isLocked: false,
            });
            for (let p = 0; p < perChannel; p++) {
              const start = dayStartMs + p * 1_800_000;
              programStore.put({
                id: `e2e_prog_${c}_${p}`,
                channelId: `e2e_ch_${c}`,
                tvgId: `e2e.${c}`,
                sourceId: 'e2e_src',
                start,
                stop: start + 1_800_000,
                title: `Show ${p}`,
                description: 'Fixture programme',
              });
            }
          }

          tx.objectStore('epgSources').put({
            id: 'e2e_src',
            playlistId: 'e2e_pl',
            name: 'E2E Guide',
            kind: 'remote',
            enabled: true,
            priority: 0,
            lastUpdatedAt: now,
            channelCount: channels,
            programmeCount: channels * perChannel,
          });

          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    { channels: channelCount, perChannel: programsPerChannel }
  );
}

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  page = await context.newPage();
  await page.goto('/');
  await page.getByRole('button', { name: /Get Started/i }).click();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Featured Live')).toBeVisible({ timeout: 15_000 });
  await seedGuide(100, 200); // 20,000 programmes
  await page.reload();
  await expect(page.getByText('Featured Live')).toBeVisible({ timeout: 15_000 });
});

test.afterAll(async () => {
  await page.context().close();
});

test('D-pad opens the guide, traverses both axes and opens/closes details', async () => {
  await page.getByTestId('navigation-rail').getByRole('button', { name: 'EPG Guide' }).click();
  await expect(page.getByText('Show 0').first()).toBeVisible({ timeout: 15_000 });

  for (let i = 0; i < 8; i += 1) await page.keyboard.press('ArrowDown');
  for (let i = 0; i < 4; i += 1) await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(400);

  const focused = await page.evaluate(() => {
    const el = document.querySelector('[data-focused="true"]') as HTMLElement | null;
    const vertical = document.querySelector('[data-scroll-axis="vertical"]') as HTMLElement | null;
    const horizontal = document.querySelector('[data-scroll-axis="horizontal"]') as HTMLElement | null;
    if (!el || !vertical || !horizontal) return { ok: false, reason: 'missing element' };
    const r = el.getBoundingClientRect();
    const v = vertical.getBoundingClientRect();
    const h = horizontal.getBoundingClientRect();
    return {
      ok: r.top >= v.top - 1 && r.bottom <= v.bottom + 1 && r.left >= h.left - 1 && r.right <= h.right + 1,
      hasTarget: el.classList.contains('tv-focus-target'),
      overflow: el.scrollHeight - el.clientHeight,
    };
  });
  expect(focused.ok, JSON.stringify(focused)).toBe(true);
  expect(focused.hasTarget).toBe(true);
  expect(focused.overflow).toBeLessThanOrEqual(1);

  await page.keyboard.press('Enter');
  await expect(page.getByText('Watch now')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByText('Watch now')).toBeHidden();
  // Focus is back on the grid after the sheet closes.
  await expect(page.locator('[data-focused="true"].tv-focus-target')).toHaveCount(1);
});

test('20k-programme traversal stays responsive under 4x CPU throttling', async () => {
  const client = await page.context().newCDPSession(page);
  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  try {
    await page.getByTestId('navigation-rail').getByRole('button', { name: 'EPG Guide' }).click();
    await page.waitForTimeout(400);

    const result = await page.evaluate(async () => {
      const durations: number[] = [];
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
        if (repeat) durations.push(performance.now() - start);
      };
      const start = performance.now();
      fire(false);
      while (performance.now() - start < 1500) {
        await new Promise((resolve) => setTimeout(resolve, 30));
        fire(true);
      }
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowDown', code: 'ArrowDown', bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 500));
      return { durations };
    });

    const sorted = result.durations.slice().sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
    expect(result.durations.length).toBeGreaterThan(4);
    expect(p95, `p95 key-handler was ${p95.toFixed(1)}ms (budget 100ms)`).toBeLessThan(100);
  } finally {
    await client.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  }
});
