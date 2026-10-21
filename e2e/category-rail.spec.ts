import { test, expect, type Page } from '@playwright/test';

/**
 * The Live TV category rail replaces the horizontal chip strip.
 *
 * Regression: the strip only scrolled when focus moved through it, so a scope
 * chosen elsewhere (a Home category tile) stayed off-screen while the strip
 * rendered focus on "All Channels". With 100+ groups the selected chip could be
 * several screens away and partly clipped at the viewport edge.
 *
 * Geometry-dependent (spatial navigation + clipping), so Chromium only.
 */
test.describe.configure({ mode: 'serial' });

const GROUP_COUNT = 24;
const CHANNEL_COUNT = 240;

function buildPlaylist(): string {
  const lines = ['#EXTM3U'];
  for (let i = 1; i <= CHANNEL_COUNT; i += 1) {
    lines.push(
      `#EXTINF:-1 tvg-id="rail${i}" group-title="Group ${i % GROUP_COUNT}",Channel ${i}`
    );
    lines.push(`https://example.invalid/stream/${i}.ts`);
  }
  return lines.join('\n');
}

let page: Page;

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  page = await context.newPage();
  await page.route('**/rail.m3u', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/vnd.apple.mpegurl',
      body: buildPlaylist(),
    })
  );
  await page.goto('/');
  await page.getByRole('button', { name: /Get Started/i }).click();
  await page.getByText('M3U / M3U8 URL').click();
  await page.keyboard.press('ArrowDown'); // Name -> URL
  await page.keyboard.press('Enter');
  await page.keyboard.type('http://localhost:3000/rail.m3u');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Featured Live')).toBeVisible({ timeout: 45_000 });
});

test.afterAll(async () => {
  await page.context().close();
});

/** Focused rail item: label, rank and whether its painted box stays unclipped. */
function railFocusState(p: Page) {
  return p.evaluate(() => {
    const focused = document.querySelector<HTMLElement>('[data-focused="true"]');
    const rail = document.querySelector<HTMLElement>('[data-testid="category-rail"]');
    const viewport = document.querySelector<HTMLElement>('[data-testid="category-rail-viewport"]');
    if (!focused || !rail || !viewport) return null;
    if (!rail.contains(focused)) return null;
    const item = focused.getBoundingClientRect();
    const clip = viewport.getBoundingClientRect();
    return {
      label: focused.getAttribute('title'),
      current: focused.getAttribute('aria-current'),
      index: Number(focused.dataset.scrollIndex),
      offset: Number(viewport.getAttribute('data-scroll-offset') ?? NaN),
      fullyVisible:
        item.left >= clip.left - 1 &&
        item.right <= clip.right + 1 &&
        item.top >= clip.top - 1 &&
        item.bottom <= clip.bottom + 1,
    };
  });
}

test('Live TV lands on the active category inside a vertical rail', async () => {
  await page.getByTestId('navigation-rail').getByRole('button', { name: 'Live TV' }).click();
  await expect(page.getByRole('heading', { name: 'All Channels' })).toBeVisible();

  await expect(page.getByTestId('category-rail')).toBeVisible();
  await expect(page.locator('[data-scroll-axis="horizontal"]')).toHaveCount(0);

  const state = await railFocusState(page);
  expect(state).not.toBeNull();
  expect(state!.label).toBe('All Channels');
  expect(state!.current).toBe('true');
  expect(state!.fullyVisible).toBe(true);
});

test('holding DOWN walks the whole rail, stays in view, and selects the last scope', async () => {
  const start = await railFocusState(page);
  expect(start).not.toBeNull();

  // 24 groups + all/favorites: DOWN past the end must stop, not wrap or leak.
  for (let i = 0; i < GROUP_COUNT + 4; i += 1) {
    await page.keyboard.press('ArrowDown');
    await expect
      .poll(
        async () => {
          const state = await railFocusState(page);
          return state ? state.fullyVisible : null;
        },
        { message: `rail item clipped at step ${i}` }
      )
      .toBe(true);
    const state = await railFocusState(page);
    expect(state, `focus left the rail at step ${i}`).not.toBeNull();
  }

  const last = await railFocusState(page);
  expect(last).not.toBeNull();
  expect(last!.index).toBe(GROUP_COUNT + 1);
  expect(last!.offset).toBeGreaterThan(0);

  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: last!.label!, exact: true })).toBeVisible();

  // The selected scope stays current and keeps focus.
  const selected = await railFocusState(page);
  expect(selected!.current).toBe('true');
  expect(selected!.label).toBe(last!.label);
});

test('re-entering Live TV reveals a scope selected outside the rail', async () => {
  const selected = await railFocusState(page);
  expect(selected).not.toBeNull();

  await page.getByTestId('navigation-rail').getByRole('button', { name: 'Home' }).click();
  await expect(page.getByText('Featured Live')).toBeVisible({ timeout: 15_000 });

  await page.getByTestId('navigation-rail').getByRole('button', { name: 'Live TV' }).click();
  await expect(page.getByRole('heading', { name: selected!.label!, exact: true })).toBeVisible();

  const restored = await railFocusState(page);
  expect(restored).not.toBeNull();
  expect(restored!.label).toBe(selected!.label);
  expect(restored!.current).toBe('true');
  expect(restored!.fullyVisible).toBe(true);
});

test('RIGHT enters the channel grid and LEFT returns to the active scope', async () => {
  await page.keyboard.press('ArrowRight');
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document
            .querySelector<HTMLElement>('[data-focused="true"][data-channel-id]')
            ?.dataset.channelId ?? null
      )
    )
    .toBeTruthy();

  await page.keyboard.press('ArrowLeft');
  const back = await railFocusState(page);
  expect(back).not.toBeNull();
  expect(back!.current).toBe('true');
  expect(back!.fullyVisible).toBe(true);

  // LEFT from the rail reaches the primary navigation rail, and RIGHT returns
  // to the remembered category instead of a stale content card.
  await page.keyboard.press('ArrowLeft');
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          !!document
            .querySelector<HTMLElement>('[data-focused="true"]')
            ?.closest('[data-testid="navigation-rail"]')
      )
    )
    .toBe(true);
  await page.keyboard.press('ArrowRight');
  const returned = await railFocusState(page);
  expect(returned).not.toBeNull();
  expect(returned!.label).toBe(back!.label);
  expect(returned!.fullyVisible).toBe(true);
});
