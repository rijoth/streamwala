import { test, expect, type Page } from '@playwright/test';
import { pressColorKey, waitForAppReady } from './helpers.ts';

/**
 * Channel logo plates are driven by the `--logo-size-*` family (ADR 034).
 *
 * Two regressions are being locked down here:
 *
 * 1. Every plate used to be a hard-coded Tailwind square (`w-20`, `w-16`, …),
 *    so the TV UI-scale setting resized the whole chrome except the logo art.
 *    Each surface must now measure exactly its token at `--ui-scale: 1` and
 *    exactly 1.5× that at `--ui-scale: 1.5`.
 * 2. The plate owns the painted logo: the `img` is 80% of the plate, which is
 *    what reproduces the old padding ratio without letting rem padding eat a
 *    px-authored plate. Asserting the image box is the only way to catch a
 *    plate that is tokenised while its art is still `w-full`.
 *
 * Geometry-dependent (real layout, real images), so Chromium only. The demo
 * playlist points at remote logos; they are fulfilled with a local SVG so the
 * `img` never collapses to 0×0 through the `onError` hide.
 */
test.describe.configure({ mode: 'serial' });

/** Documented base sizes at `--ui-scale: 1`. A silent retune fails here. */
const BASE: Record<string, number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 48,
  xl: 88,
  '2xl': 96,
  hero: 256,
};

const STUB_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#1b4578"/></svg>`;

let page: Page;

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  page = await context.newPage();
  await page.route('**/upload.wikimedia.org/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/svg+xml', body: STUB_SVG })
  );
  await openDemoHome(page);
});

test.afterAll(async () => {
  await page.context().close();
});

async function openDemoHome(p: Page) {
  await p.goto('/');
  await waitForAppReady(p);
  await p.getByRole('button', { name: /Get Started/i }).click();
  // Source grid: M3U has autoFocus; Local is below it, Demo to its right.
  await p.keyboard.press('ArrowDown');
  await p.keyboard.press('ArrowRight');
  await p.keyboard.press('Enter');
  await expect(p.getByText('Featured Live')).toBeVisible({ timeout: 30_000 });
}

function rail(p: Page, label: string) {
  return p.getByTestId('navigation-rail').getByRole('button', { name: label });
}

/** Writes `--ui-scale` the same way `applyTheme` does: inline on the root. */
async function setUiScale(scale: number) {
  await page.evaluate((value) => {
    document.documentElement.style.setProperty('--ui-scale', String(value));
  }, scale);
  await page.waitForTimeout(300);
}

/**
 * Base px of a `--logo-size-*` token, read from the computed custom property.
 * The value is a `calc(Npx * var(--ui-scale))` product, so only `N` is parsed
 * here — the live size is proven by measuring the rendered plate instead of by
 * trusting the stylesheet.
 */
function readBasePx(name: string) {
  return page.evaluate((token) => {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(
      `--logo-size-${token}`
    );
    const match = raw.match(/calc\(\s*([\d.]+)/);
    return match ? Number(match[1]) : Number.NaN;
  }, name);
}

interface PlateMetric {
  token: string;
  isPlate: boolean;
  width: number;
  height: number;
  imgWidth: number;
  imgHeight: number;
  objectFit: string | null;
  cellHeight: number;
  cellOverflow: number;
}

/**
 * Measures every element carrying `data-logo-plate` within `scope`, filtered to
 * one token. Plates without an `img` (the initials fallback) report 0 for the
 * image box so callers can skip the 80% assertion instead of special-casing.
 */
function measurePlates(scope: string | null, token: string): Promise<PlateMetric[]> {
  return page.evaluate(
    ({ selector, wanted }) => {
      const root: ParentNode = selector ? document.querySelector(selector)! : document;
      if (!root) return [];
      const nodes = Array.from(root.querySelectorAll<HTMLElement>(`[data-logo-plate="${wanted}"]`));
      return nodes.slice(0, 6).map((plate) => {
        const isPlate = plate.tagName !== 'IMG';
        const img = isPlate ? plate.querySelector('img') : (plate as HTMLImageElement);
        const box = plate.getBoundingClientRect();
        const imgBox = img ? img.getBoundingClientRect() : null;
        const cell = plate.closest<HTMLElement>('[data-scroll-index], [data-channel-id]');
        return {
          token: plate.dataset.logoPlate ?? '',
          isPlate,
          width: box.width,
          height: box.height,
          imgWidth: imgBox?.width ?? 0,
          imgHeight: imgBox?.height ?? 0,
          objectFit: img ? getComputedStyle(img).objectFit : null,
          cellHeight: cell ? cell.getBoundingClientRect().height : 0,
          cellOverflow: cell ? cell.scrollHeight - cell.clientHeight : 0,
        };
      });
    },
    { selector: scope, wanted: token }
  );
}

/** Waits until at least `min` plates of a token are painted (guides load lazily). */
async function waitForPlates(token: string, min = 1) {
  await expect
    .poll(() => page.locator(`[data-logo-plate="${token}"]`).count(), { timeout: 15_000 })
    .toBeGreaterThanOrEqual(min);
}

/**
 * Asserts the surface's plates are square at `scale × BASE[token]`, that the
 * painted logo is 80% of the plate (unless the img *is* the plate), and that
 * nothing in the containing cell is clipped.
 */
async function expectPlates(
  scope: string | null,
  token: string,
  scale = 1,
  minCount = 1
): Promise<PlateMetric[]> {
  const expected = BASE[token] * scale;
  const basePx = await readBasePx(token);
  // The stylesheet token and this spec must agree before anything is measured.
  expect(basePx, `--logo-size-${token} base px`).toBe(BASE[token]);

  const plates = await measurePlates(scope, token);
  expect(plates.length, `plate ${token} in ${scope ?? 'document'}`).toBeGreaterThanOrEqual(
    minCount
  );

  for (const plate of plates) {
    expect(plate.token).toBe(token);
    expect(Math.abs(plate.width - expected), `plate width (got ${plate.width})`).toBeLessThanOrEqual(1);
    expect(Math.abs(plate.height - expected), `plate height (got ${plate.height})`).toBeLessThanOrEqual(1);
    expect(plate.cellOverflow, 'cell clipped by overflow-hidden').toBeLessThanOrEqual(1);

    if (!plate.isPlate) continue;
    if (plate.imgWidth === 0 && plate.imgHeight === 0) continue; // initials fallback
    expect(Math.abs(plate.imgWidth - expected * 0.8), `painted logo width`).toBeLessThanOrEqual(1);
    expect(Math.abs(plate.imgHeight - expected * 0.8), `painted logo height`).toBeLessThanOrEqual(1);
    expect(plate.objectFit, 'logo art must never distort').toBe('contain');
  }
  return plates;
}

test('Home tiles and the hero watermark follow their tokens', async () => {
  await rail(page, 'Home').click();
  await expect(page.getByTestId('home-viewport')).toBeVisible();

  const tiles = await expectPlates('[data-testid="home-viewport"]', 'xl', 1, 2);
  // The logo is the tile's primary identifier, but the name/now-next block
  // below it still has to read: keep the plate below half the card.
  for (const tile of tiles) {
    expect(tile.height, `home tile plate vs card ${tile.cellHeight}`).toBeLessThan(
      tile.cellHeight * 0.5
    );
  }

  const hero = await expectPlates(null, 'hero', 1, 1);
  expect(hero[0].isPlate, 'hero watermark is a bare img').toBe(false);
});

test('Live TV grid plates are the 2xl token with an 80% logo', async () => {
  await rail(page, 'Live TV').click();
  await expect(page.getByTestId('live-viewport')).toBeVisible();

  const cards = await expectPlates('[data-testid="live-viewport"]', '2xl', 1, 2);
  for (const card of cards) {
    // 96px inside a card that the number row and two text lines grow past
    // 220px: the plate identifies the channel without swallowing the card.
    expect(card.cellHeight, 'grid card height').toBeGreaterThan(200);
    expect(card.height, `grid plate vs card ${card.cellHeight}`).toBeLessThan(
      card.cellHeight * 0.45
    );
  }
});

test('Live TV list rows use the md token and keep the row unclipped', async () => {
  await page.getByRole('button', { name: /List View/i }).click();
  await expect(page.getByRole('button', { name: /Grid View/i })).toBeVisible();
  await page.waitForTimeout(300);

  const rows = await expectPlates('[data-testid="live-viewport"]', 'md', 1, 2);
  for (const row of rows) {
    expect(row.height, `list plate vs row ${row.cellHeight}`).toBeLessThan(row.cellHeight);
  }

  await page.getByRole('button', { name: /Grid View/i }).click();
  await page.waitForTimeout(300);
});

test('Home search results use the xl token', async () => {
  await rail(page, 'Home').click();
  await expect(page.getByTestId('home-viewport')).toBeVisible();
  await pressColorKey(page, 'Yellow', 405);
  // Yellow only moves the engine cursor; ENTER hands the caret to the field.
  await page.keyboard.press('Enter');
  await page.keyboard.type('nasa');
  await expect(page.getByTestId('home-search-viewport')).toBeVisible();

  await expectPlates('[data-testid="home-search-viewport"]', 'xl', 1, 1);

  await page.keyboard.press('Enter');
  for (let i = 0; i < 4; i += 1) await page.keyboard.press('Backspace');
  await expect(page.getByText('Featured Live')).toBeVisible({ timeout: 5000 });
});

test('Favourites plates match the grid card token', async () => {
  await rail(page, 'Live TV').click();
  await expect(page.getByTestId('live-viewport')).toBeVisible();

  // Pin the first card so the Favorites view is not empty, then leave the view.
  await page.locator('[data-testid="live-viewport"] [data-scroll-index="0"] button').first().click();
  await page.waitForTimeout(400);

  await rail(page, 'Favorites').click();
  await expect(page.getByTestId('favorites-viewport')).toBeVisible();
  await expectPlates('[data-testid="favorites-viewport"]', '2xl', 1, 1);
});

/**
 * The guide's empty state replaces the whole grid when the active playlist has
 * no EPG source at all, so the channel column (and its plates) only exist once
 * a source row is attached. Programs are deliberately not seeded: the axis this
 * spec cares about is the channel column, not the timeline.
 */
async function attachEmptyEpgSource() {
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('AetherIptvDatabase');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction(['playlists', 'epgSources'], 'readwrite');
          const playlists = tx.objectStore('playlists').getAll();
          playlists.onsuccess = () => {
            const active = (playlists.result as Array<{ id: string; isActive?: boolean }>).find(
              (row) => row.isActive
            );
            if (!active) {
              reject(new Error('no active playlist to attach the guide source to'));
              return;
            }
            tx.objectStore('epgSources').put({
              id: 'e2e_logo_src',
              playlistId: active.id,
              name: 'Logo geometry guide',
              kind: 'remote',
              enabled: true,
              priority: 0,
              lastUpdatedAt: Date.now(),
              channelCount: 0,
              programmeCount: 0,
            });
          };
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      })
  );
}

test('EPG channel column uses the xs token inside the fixed 72px row', async () => {
  await attachEmptyEpgSource();
  await page.reload();
  await waitForAppReady(page);
  await expect(page.getByText('Featured Live')).toBeVisible({ timeout: 30_000 });

  await rail(page, 'EPG Guide').click();
  await expect(page.getByText('Program Guide')).toBeVisible();
  await expect(page.getByText('No program guide attached')).toHaveCount(0);
  await waitForPlates('xs', 2);

  const plates = await expectPlates(null, 'xs', 1, 2);
  for (const plate of plates) {
    expect(plate.height, 'EPG row height').toBeLessThan(72);
  }
});

test('every surface scales with --ui-scale at 1920x1080', async () => {
  await setUiScale(1.5);

  await rail(page, 'Home').click();
  await expectPlates('[data-testid="home-viewport"]', 'xl', 1.5, 2);

  await rail(page, 'Live TV').click();
  await expect(page.getByTestId('live-viewport')).toBeVisible();
  const cards = await expectPlates('[data-testid="live-viewport"]', '2xl', 1.5, 2);
  for (const card of cards) {
    // A 144px plate in a 330px card is the intended ceiling at 150%.
    expect(card.height, `grid plate vs card ${card.cellHeight}`).toBeLessThan(
      card.cellHeight * 0.5
    );
  }

  await page.getByRole('button', { name: /List View/i }).click();
  await page.waitForTimeout(300);
  await expectPlates('[data-testid="live-viewport"]', 'md', 1.5, 2);
  await page.getByRole('button', { name: /Grid View/i }).click();
  await page.waitForTimeout(300);

  await rail(page, 'Favorites').click();
  await expect(page.getByTestId('favorites-viewport')).toBeVisible();
  await expectPlates('[data-testid="favorites-viewport"]', '2xl', 1.5, 1);

  await rail(page, 'EPG Guide').click();
  await waitForPlates('xs', 2);
  await expectPlates(null, 'xs', 1.5, 2);

  await setUiScale(1);
});

test('the 150% setting still fits a 1280x720 canvas at its automatic fit', async () => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await setUiScale(1.5);

  // A 1280x720 CSS canvas is a 2/3 render of the 1920 design, so the 150%
  // preference resolves to 100% of the design canvas (0.667 x 1.5 = 1.0).
  // That is the intended behaviour of a scale-relative-to-screen-fit setting.
  await rail(page, 'Live TV').click();
  await expect(page.getByTestId('live-viewport')).toBeVisible();
  await expectPlates('[data-testid="live-viewport"]', '2xl', 1, 1);

  await rail(page, 'EPG Guide').click();
  await waitForPlates('xs', 1);
  await expectPlates(null, 'xs', 1, 1);

  await setUiScale(1);
  await page.setViewportSize({ width: 1920, height: 1080 });
});
