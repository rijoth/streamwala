import { test, expect, type Page } from '@playwright/test';
import { waitForAppReady } from './helpers.ts';

/**
 * Stream transport policy — regression coverage for BUG-023.
 *
 * A CORS proxy configured in Settings (or set by the error overlay's one-tap
 * "Try with CORS Proxy") was applied to every stream URL unconditionally. When
 * the proxy went down or blocklisted the provider, *every* channel failed with
 * "Stream Unavailable" — including channels whose origin already answered with
 * `Access-Control-Allow-Origin: *`. `PlayerManager` now plans transports,
 * attempting the origin directly and only falling back to the proxy when the
 * direct attempt fails (mixed content being the one exception, where the proxy
 * is the only viable transport).
 *
 * Both specs are fully routed: no real network, no third-party proxy.
 */

const PROXY_HOST = 'api.allorigins.win';
const ORIGIN_HOST = 'probe.example.invalid';
const PROXY_TEMPLATE = `https://${PROXY_HOST}/raw?url={url}`;

const MANIFEST = [
  '#EXTM3U',
  '#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360',
  'media.m3u8',
  '',
].join('\n');

const MEDIA = [
  '#EXTM3U',
  '#EXT-X-VERSION:3',
  '#EXT-X-TARGETDURATION:4',
  '#EXT-X-MEDIA-SEQUENCE:0',
  '#EXTINF:4.0,',
  'seg.ts',
  '',
].join('\n');

const PLAYLIST = [
  '#EXTM3U',
  '#EXTINF:-1 tvg-id="probe1" group-title="Probe",Probe One',
  `https://${ORIGIN_HOST}/live.m3u8`,
  '',
].join('\n');

/** Serves the HLS ladder for whichever URL the player asks for. */
function hlsBody(url: string): { contentType: string; body: string } {
  if (url.includes('media')) {
    return { contentType: 'application/vnd.apple.mpegurl', body: MEDIA };
  }
  if (url.endsWith('.m3u8')) {
    return { contentType: 'application/vnd.apple.mpegurl', body: MANIFEST };
  }
  return { contentType: 'video/mp2t', body: '' };
}

/**
 * Imports the probe playlist with no proxy configured, then persists the proxy
 * setting and reloads — the user path where a proxy chosen in an earlier
 * session is still in `localStorage` (and in the settings store) on boot.
 */
async function bootWithProxy(page: Page) {
  await page.route('**/probe.m3u', (route) =>
    route.fulfill({ status: 200, contentType: 'application/vnd.apple.mpegurl', body: PLAYLIST })
  );

  await page.goto('/');
  await page.getByRole('button', { name: /Get Started/i }).click();
  await page.getByText('M3U / M3U8 URL').click();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.keyboard.type('http://localhost:3000/probe.m3u');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Featured Live')).toBeVisible({ timeout: 45_000 });

  await page.evaluate((template) => {
    localStorage.setItem('aether_iptv_settings_v1', JSON.stringify({ proxyUrlTemplate: template }));
  }, PROXY_TEMPLATE);

  await page.reload();
  await waitForAppReady(page);
}

const streamUnavailable = (page: Page) => page.getByText('Stream Unavailable');

test('a dead CORS proxy no longer breaks a channel that streams directly', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  const attempted: string[] = [];

  await page.route(`**/${PROXY_HOST}/**`, (route) => {
    attempted.push('proxied');
    // The real failure the bug report showed: Cloudflare 522, no CORS headers.
    return route.fulfill({ status: 522, contentType: 'text/plain', body: 'error code: 522' });
  });

  await page.route(`**/${ORIGIN_HOST}/**`, (route) => {
    attempted.push('direct');
    const { contentType, body } = hlsBody(route.request().url());
    return route.fulfill({ status: 200, contentType, body });
  });

  await bootWithProxy(page);
  attempted.length = 0;

  await page.getByRole('button', { name: /Watch Now/i }).click();
  await expect(page.locator('video')).toHaveCount(1);

  // The player must fetch the origin itself (manifest + segments)…
  await expect.poll(() => attempted.filter((t) => t === 'direct').length).toBeGreaterThan(0);
  // …and must never touch the dead proxy with a persisted (not opted-in) setting.
  expect(attempted).not.toContain('proxied');
  await expect(streamUnavailable(page)).toHaveCount(0);

  await context.close();
});

test('direct failure falls back to the configured proxy', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  const attempted: string[] = [];

  // Origin unreachable / CORS-blocked: every direct attempt fails.
  await page.route(`**/${ORIGIN_HOST}/**`, (route) => {
    attempted.push('direct');
    return route.abort('failed');
  });

  await page.route(`**/${PROXY_HOST}/**`, (route) => {
    attempted.push('proxied');
    const target = new URL(route.request().url()).searchParams.get('url') ?? '';
    const { contentType, body } = hlsBody(target);
    return route.fulfill({ status: 200, contentType, body });
  });

  await bootWithProxy(page);
  attempted.length = 0;

  await page.getByRole('button', { name: /Watch Now/i }).click();
  await expect(page.locator('video')).toHaveCount(1);

  await expect.poll(() => attempted.includes('proxied')).toBe(true);
  // Direct is tried first even when a proxy is configured; the proxy only
  // takes over afterwards.
  expect(attempted[0]).toBe('direct');
  await expect(streamUnavailable(page)).toHaveCount(0);

  await context.close();
});
