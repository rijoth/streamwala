import { test, expect, type Page } from '@playwright/test';
import { waitForAppReady } from './helpers.ts';

/**
 * End-to-end proof that a remote XMLTV source is actually downloaded, parsed and
 * persisted (BUG-025: the worker was created but never messaged, so every
 * refresh sat on "Downloading… 0 B" and only failed 90 s later with a bogus
 * "stalled while downloading" error).
 *
 * The guide host is intercepted so the spec never touches the network, but the
 * whole real pipeline runs: worker RPC → streaming fetch → tokenizer → matching
 * → Dexie → status line.
 */
const EPG_URL = 'https://epg.example.invalid/guide.xml';
const PLAYLIST_ID = 'e2e_epg_pl';
const SOURCE_ID = 'e2e_epg_src';

const XMLTV = `<?xml version="1.0" encoding="UTF-8"?>
<tv source-info-name="E2E">
  <channel id="e2e.one">
    <display-name>E2E One</display-name>
  </channel>
  <channel id="e2e.two">
    <display-name>E2E Two</display-name>
  </channel>
  <programme channel="e2e.one" start="20240101120000 +0000" stop="20240101130000 +0000">
    <title>E2E Show One</title>
    <desc>Fixture programme</desc>
  </programme>
  <programme channel="e2e.two" start="20240101120000 +0000" stop="20240101130000 +0000">
    <title>E2E Show Two</title>
  </programme>
</tv>`;

/** Programmes must land inside the retention window, so dates are relative. */
function xmltvForNow(): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = (ms: number) => {
    const d = new Date(ms);
    return (
      `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
      `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())} +0000`
    );
  };
  const start = stamp(Date.now() - 30 * 60_000);
  const stop = stamp(Date.now() + 30 * 60_000);
  return XMLTV.replaceAll('20240101120000 +0000', start).replaceAll(
    '20240101130000 +0000',
    stop
  );
}

async function seed(page: Page): Promise<void> {
  await page.evaluate(
    ({ playlistId, sourceId, epgUrl }) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('AetherIptvDatabase');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction(['playlists', 'channels', 'epgSources'], 'readwrite');
          const now = Date.now();
          const playlists = tx.objectStore('playlists');
          const existing = playlists.getAll();
          existing.onsuccess = () => {
            for (const row of existing.result as Array<{ id: string }>) {
              playlists.put({ ...row, isActive: false });
            }
          };
          playlists.put({
            id: playlistId,
            name: 'E2E Playlist',
            type: 'm3u',
            createdAt: now,
            lastSyncedAt: now,
            channelCount: 2,
            isActive: true,
            epgPromptDismissed: true,
          });
          const channels = tx.objectStore('channels');
          channels.put({
            id: 'e2e_epg_ch1',
            playlistId,
            name: 'E2E One',
            groupId: 'e2e',
            groupName: 'E2E',
            streamUrl: 'https://example.invalid/one.m3u8',
            tvgId: 'e2e.one',
            number: 1,
          });
          channels.put({
            id: 'e2e_epg_ch2',
            playlistId,
            name: 'E2E Two',
            groupId: 'e2e',
            groupName: 'E2E',
            streamUrl: 'https://example.invalid/two.m3u8',
            tvgId: 'e2e.two',
            number: 2,
          });
          tx.objectStore('epgSources').put({
            id: sourceId,
            playlistId,
            name: 'E2E Guide',
            url: epgUrl,
            kind: 'remote',
            enabled: true,
            priority: 0,
            channelCount: 0,
            programmeCount: 0,
          });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    { playlistId: PLAYLIST_ID, sourceId: SOURCE_ID, epgUrl: EPG_URL }
  );
}

/** Opens the EPG panel of the seeded playlist (other playlists may exist). */
async function openEpgPanel(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Settings/i }).first().click();
  await page.getByRole('button', { name: /Manage Playlists/i }).click();
  const targets = page.getByRole('button', { name: /Edit EPG/i });
  const count = await targets.count();
  for (let i = 0; i < count; i += 1) {
    const candidate = targets.nth(i);
    const card = await candidate.evaluate((el) => el.closest('div.p-4')?.textContent ?? '');
    if (card.includes('E2E Playlist')) {
      await candidate.click();
      return;
    }
  }
  throw new Error('EPG panel entry point for the seeded playlist was not found');
}

test('a remote XMLTV source downloads, parses and persists', async ({ page }) => {
  await page.route(EPG_URL, (route) =>
    route.fulfill({
      status: 200,
      headers: {
        'content-type': 'text/xml; charset=utf-8',
        'access-control-allow-origin': '*',
      },
      body: xmltvForNow(),
    })
  );

  await page.goto('/');
  await page.getByRole('button', { name: /Get Started/i }).click();
  await waitForAppReady(page);
  await seed(page);
  await page.reload();
  await page.getByText('Featured Live').waitFor({ timeout: 15_000 });

  // The scheduler refreshes the stale source on boot; open the panel to read it.
  await openEpgPanel(page);

  await expect(page.getByText(/2 channels · 2 programmes/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Guide last updated/)).toBeVisible();
  await expect(page.getByText(/No guide data yet/)).toHaveCount(0);
  await expect(page.getByText(/stalled while downloading/i)).toHaveCount(0);
});

test('a source the host refuses with CORS fails fast with honest copy', async ({ page }) => {
  // Chromium reports a CORS refusal as a failed request ("Failed to fetch"), so
  // aborting the route reproduces it — `route.fulfill` bypasses the CORS check.
  await page.route(EPG_URL, (route) => route.abort('failed'));

  await page.goto('/');
  await page.getByRole('button', { name: /Get Started/i }).click();
  await waitForAppReady(page);
  await seed(page);
  await page.reload();
  await page.getByText('Featured Live').waitFor({ timeout: 15_000 });

  await openEpgPanel(page);

  // A failed background refresh is silent here, so drive one from the panel.
  await page.getByRole('button', { name: /Refresh now/i }).first().click();

  const banner = page.getByText(/blocked the browser request \(CORS\)/i);
  await expect(banner).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Local storage is unavailable/i)).toHaveCount(0);
  await expect(page.getByText(/stalled while downloading/i)).toHaveCount(0);
});
