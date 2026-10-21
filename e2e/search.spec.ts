import { test, expect, type Page } from '@playwright/test';
import { pressColorKey, waitForAppReady } from './helpers.ts';

/**
 * Inline per-screen search: Yellow remote-key routing, query scoping, and the
 * filtered-grid focus/scroll guard. Geometry-dependent (spatial navigation),
 * so it runs in Chromium only.
 */
test.describe.configure({ mode: 'serial' });

let page: Page;

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  page = await context.newPage();
  await openDemoHome(page);
});

test.afterAll(async () => {
  await page.context().close();
});

function rail(p: Page, label: string) {
  return p.getByTestId('navigation-rail').getByRole('button', { name: label });
}

async function openDemoHome(p: Page) {
  await p.goto('/');
  await waitForAppReady(p);
  await p.getByRole('button', { name: /Get Started/i }).click();
  // Source grid: M3U has autoFocus; Local is below it, Demo to its right.
  await p.keyboard.press('ArrowDown');
  await p.keyboard.press('ArrowRight');
  await p.keyboard.press('Enter');
  await expect(p.getByText('Featured Live')).toBeVisible({ timeout: 15_000 });
}

/** Label of the *engine* focus cursor when it sits on a text field. */
function focusedFieldLabel(p: Page) {
  return p.evaluate(() => {
    const el = document.querySelector<HTMLElement>('[data-focused="true"]');
    return el?.querySelector('input')?.getAttribute('aria-label') ?? null;
  });
}

/** Channel id of the focused card, when the cursor is on one. */
function focusedChannelId(p: Page) {
  return p.evaluate(
    () =>
      document.querySelector<HTMLElement>('[data-focused="true"][data-channel-id]')?.dataset
        .channelId ?? null
  );
}

function activeElementState(p: Page) {
  return p.evaluate(() => ({
    tag: document.activeElement?.tagName ?? null,
    hasFocusCursor: !!document.querySelector('[data-focused="true"]'),
  }));
}

async function expectFocusedField(p: Page, label: string) {
  await expect.poll(async () => focusedFieldLabel(p), { timeout: 5_000 }).toBe(label);
}

/** The inline field must sit centred in the content column, not pinned left. */
async function expectFieldCentred(p: Page, label: string) {
  const centring = await p.evaluate((ariaLabel) => {
    const input = document.querySelector<HTMLInputElement>(
      `input[aria-label="${ariaLabel}"]`
    );
    const field = input?.closest<HTMLElement>('.tv-focus-target');
    const main = document.querySelector<HTMLElement>('main');
    if (!field || !main) return null;
    const fieldBox = field.getBoundingClientRect();
    const mainBox = main.getBoundingClientRect();
    return {
      fieldCentre: fieldBox.left + fieldBox.width / 2,
      mainCentre: mainBox.left + mainBox.width / 2,
      fieldWidth: fieldBox.width,
      mainWidth: mainBox.width,
    };
  }, label);
  expect(centring).not.toBeNull();
  expect(Math.abs(centring!.fieldCentre - centring!.mainCentre)).toBeLessThanOrEqual(2);
  expect(centring!.fieldWidth).toBeLessThan(centring!.mainWidth);
}

/** D-pad Enter puts the caret in the field; then type like a remote keyboard. */
async function typeInFocusedField(p: Page, text: string) {
  await p.keyboard.press('Enter');
  await expect.poll(async () => (await activeElementState(p)).tag).toBe('INPUT');
  await p.keyboard.type(text);
}

function chip(p: Page, label: string) {
  return p.getByTestId('category-rail').getByRole('button', { name: label });
}

/** Walk LEFT until the engine cursor lands inside the category rail. */
async function focusCategoryRail(p: Page) {
  for (let i = 0; i < 6; i += 1) {
    const inRail = await p.evaluate(() =>
      !!document.querySelector('[data-focused="true"]')?.closest('[data-testid="category-rail"]')
    );
    if (inRail) return;
    await p.keyboard.press('ArrowLeft');
  }
  await expect
    .poll(() =>
      p.evaluate(() =>
        !!document.querySelector('[data-focused="true"]')?.closest('[data-testid="category-rail"]')
      )
    )
    .toBe(true);
}

/** Walk DOWN until the engine cursor lands on a channel card. */
async function focusFirstChannel(p: Page) {
  // Live TV enters on the category rail; RIGHT hands focus to the grid.
  const onRail = await p.evaluate(() =>
    !!document.querySelector('[data-focused="true"]')?.closest('[data-testid="category-rail"]')
  );
  if (onRail) await p.keyboard.press('ArrowRight');
  for (let i = 0; i < 6; i += 1) {
    if (await focusedChannelId(p)) return;
    await p.keyboard.press('ArrowDown');
  }
  await expect.poll(async () => focusedChannelId(p)).toBeTruthy();
}

/** Offset of the Live TV result grid (the rail also has a vertical axis). */
function verticalOffset(p: Page) {
  return p.evaluate(() => {
    const viewport = document.querySelector<HTMLElement>('[data-testid="live-viewport"]');
    return viewport ? Number(viewport.getAttribute('data-scroll-offset')) : null;
  });
}

test('the navigation rail has no Search destination', async () => {
  const labels = await page
    .getByTestId('navigation-rail')
    .locator('button')
    .evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-label')));
  expect(labels).not.toContain('Search');
  expect(labels).toEqual(['Home', 'Live TV', 'EPG Guide', 'Favorites', 'Settings']);
});

test('Yellow on Home focuses the inline search field and filters rows', async () => {
  await rail(page, 'Home').click();
  await pressColorKey(page, 'Yellow', 405);
  await expectFocusedField(page, 'Search all channels');

  await expectFieldCentred(page, 'Search all channels');

  await typeInFocusedField(page, 'nasa');

  await expect(page.getByText('Found 1 matching channel')).toBeVisible();
  await expect(page.getByText('NASA TV HD (Public Live)')).toBeVisible();
  await expect(page.getByText('Featured Live')).toHaveCount(0);
  await expect(page.getByTestId('home-search-viewport')).toBeVisible();
  // The field keeps both DOM focus and the engine cursor while typing.
  expect(await activeElementState(page)).toMatchObject({ tag: 'INPUT' });
  expect(await focusedFieldLabel(page)).toBe('Search all channels');

  // DOWN enters the result grid, UP returns to the field.
  await page.keyboard.press('ArrowDown');
  await expect.poll(async () => focusedChannelId(page)).toBeTruthy();
  await page.keyboard.press('ArrowUp');
  await expectFocusedField(page, 'Search all channels');

  // Clearing restores the hero + rows without stealing the caret.
  await page.keyboard.press('Enter');
  for (let i = 0; i < 4; i += 1) await page.keyboard.press('Backspace');
  await expect(page.getByText('Featured Live')).toBeVisible({ timeout: 5_000 });
  await expect(page.getByTestId('home-search-viewport')).toHaveCount(0);
  expect(await activeElementState(page)).toMatchObject({ tag: 'INPUT' });
  expect(await focusedFieldLabel(page)).toBe('Search all channels');
});

test('Live TV search follows the selected category and survives the view toggle', async () => {
  await rail(page, 'Live TV').click();
  await expect(page.getByRole('heading', { name: 'All Channels' })).toBeVisible();

  await pressColorKey(page, 'Yellow', 405);
  await expectFocusedField(page, 'Search channels');

  await typeInFocusedField(page, 'news');
  await expect(page.getByText('1 of 8')).toBeVisible();

  // Sports has no "news" match: the same query is re-run against the new scope.
  await chip(page, 'Sports & Outdoors').click();
  await expect(page.getByText('0 of 2')).toBeVisible();
  await expect(page.getByText('No channels match your search')).toBeVisible();
  await expect(page.getByTestId('live-viewport')).toBeVisible();

  await chip(page, 'Science & Documentary').click();
  await expect(page.getByText('1 of 3')).toBeVisible();
  await expect(page.getByText('Deutsche Welle (DW Live News HD)')).toBeVisible();

  // The view toggle applies to the filtered result set, not the category rail.
  await page.getByRole('button', { name: /List View/i }).click();
  await expect(page.getByText('1 of 3')).toBeVisible();
  await expect(page.getByText('Deutsche Welle (DW Live News HD)')).toBeVisible();
  await page.getByRole('button', { name: /Grid View/i }).click();
});

test('Live TV D-pad path is category rail -> results -> back to the active scope', async () => {
  await rail(page, 'Live TV').click();
  await chip(page, 'All Channels').click();
  await focusCategoryRail(page);

  // RIGHT enters the channel grid at the remembered card.
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => focusedChannelId(page)).toBeTruthy();

  // LEFT returns to the category rail, on the active scope.
  await page.keyboard.press('ArrowLeft');
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const el = document.querySelector('[data-focused="true"]');
        return (el?.closest('[data-testid="category-rail"]') ? el.textContent : null) ?? '';
      })
    )
    .toContain('All Channels');
});

test('Favorites search filters the pinned set and falls back to the field on unpin', async () => {
  // The demo playlist seeds four pinned channels; Big Buck Bunny is one of them.
  await rail(page, 'Favorites').click();
  await expect(page.getByRole('heading', { name: 'Favorite Channels' })).toBeVisible();
  await expect(page.getByText('4 Pinned')).toBeVisible();
  await pressColorKey(page, 'Yellow', 405);
  await expectFocusedField(page, 'Search favorites');
  await expectFieldCentred(page, 'Search favorites');

  await typeInFocusedField(page, 'buck');
  await expect(page.getByText('1 Match')).toBeVisible();
  await expect(page.getByText('Big Buck Bunny (Blender HLS)')).toBeVisible();

  await page.keyboard.press('ArrowDown');
  await expect.poll(async () => focusedChannelId(page)).toBeTruthy();
  await pressColorKey(page, 'Red', 403);

  // The unpinned focused card is gone and focus returns to the search field.
  await expectFocusedField(page, 'Search favorites');
  await expect(page.getByText('Big Buck Bunny (Blender HLS)')).toHaveCount(0);
  await expect(page.getByText('0 Match')).toBeVisible();
  const active = await activeElementState(page);
  expect(active.hasFocusCursor).toBe(true);
  expect(active.tag).not.toBe('BODY');
});

test('Yellow on Guide routes to Live TV with the full scope and focuses search', async () => {
  // Leave Live TV scoped to one group so the Yellow route has to reset it.
  await rail(page, 'Live TV').click();
  await chip(page, 'Sports & Outdoors').click();
  await expect(page.getByRole('heading', { name: 'Sports & Outdoors' })).toBeVisible();

  await rail(page, 'EPG Guide').click();
  await pressColorKey(page, 'Yellow', 405);

  await expect(page.getByRole('button', { name: 'Live TV' })).toHaveAttribute(
    'aria-current',
    'page'
  );
  await expectFocusedField(page, 'Search channels');
  await expect(page.getByRole('heading', { name: 'All Channels' })).toBeVisible();
});

test('Yellow on Settings routes to Live TV and focuses search', async () => {
  await rail(page, 'Settings').click();
  await pressColorKey(page, 'Yellow', 405);

  await expect(page.getByRole('button', { name: 'Live TV' })).toHaveAttribute(
    'aria-current',
    'page'
  );
  await expectFocusedField(page, 'Search channels');
});

test('Yellow in the player closes it and focuses Live TV search', async () => {
  await rail(page, 'Live TV').click();
  await chip(page, 'All Channels').click();
  await focusFirstChannel(page);
  await page.keyboard.press('Enter');
  await expect(page.locator('video')).toBeVisible();

  await pressColorKey(page, 'Yellow', 405);

  await expect(page.locator('video')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Live TV' })).toHaveAttribute(
    'aria-current',
    'page'
  );
  await expectFocusedField(page, 'Search channels');
});

test('narrowing a scrolled result set clamps the offset instead of leaving a blank viewport', async () => {
  await page.setViewportSize({ width: 1280, height: 400 });
  await page.waitForTimeout(200);

  await rail(page, 'Live TV').click();
  await chip(page, 'All Channels').click();
  await focusFirstChannel(page);
  for (let i = 0; i < 4; i += 1) await page.keyboard.press('ArrowDown');
  await expect.poll(async () => (await verticalOffset(page)) ?? 0).toBeGreaterThan(0);

  await pressColorKey(page, 'Yellow', 405);
  await expectFocusedField(page, 'Search channels');
  await typeInFocusedField(page, 'nasa');

  await expect(page.getByText('1 of 8')).toBeVisible();
  await expect.poll(async () => verticalOffset(page)).toBe(0);

  await page.keyboard.press('ArrowDown');
  const visible = await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>('[data-focused="true"][data-channel-id]');
    const viewport = document.querySelector<HTMLElement>('[data-testid="live-viewport"]');
    if (!el || !viewport) return false;
    const card = el.getBoundingClientRect();
    const clip = viewport.getBoundingClientRect();
    // The grid may be shorter than one card at this forced viewport; what
    // matters is that the focused result intersects it instead of the stale
    // offset leaving a blank pane.
    return card.bottom > clip.top && card.top < clip.bottom;
  });
  expect(visible).toBe(true);

  await page.setViewportSize({ width: 1920, height: 1080 });
});
