import { test, expect, type Page } from '@playwright/test';
import { pressColorKey, waitForAppReady } from './helpers.ts';

/**
 * What focus *looks* like, not just where it is.
 *
 * `e2e/dpad.spec.ts` proves the cursor lands on a `tv-focus-target`; this spec
 * proves that target is actually visibly focused: the scale from
 * `--focus-scale` (and `--focus-scale-key` for small keys), the 3 px ring in
 * `--md-sys-color-focus-ring`, the two-layer elevation shadow, the stacking
 * order, that the scale is released when focus moves on, and that
 * `prefers-reduced-motion` drops the interpolation but keeps the cue.
 *
 * Everything is read from `getComputedStyle`, so a component that re-adds a
 * dead Tailwind `ring-*`/`scale-*` utility (the unlayered `.tv-focused` rule
 * wins, so such utilities are no-ops) or a class that never applies is caught.
 */
test.describe.configure({ mode: 'serial' });

const BASE_SCALE_MIN = 1.049;
const BASE_SCALE_MAX = 1.06;
const KEY_SCALE_MIN = 1.075;
const KEY_SCALE_MAX = 1.09;

let page: Page;

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  page = await context.newPage();
  await page.goto('/');
  await waitForAppReady(page);
  await page.getByRole('button', { name: /Get Started/i }).click();
  // Source grid: M3U has autoFocus; Local is below it, Demo to its right.
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Featured Live')).toBeVisible({ timeout: 15_000 });
});

test.afterAll(async () => {
  await page.context().close();
});

interface ClipRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface FocusVisuals {
  isControl: boolean;
  isKey: boolean;
  scale: number;
  shadow: string;
  layers: number;
  firstLayer: string;
  ringRgb: string;
  transitionDuration: string;
  zIndex: string;
  clip: ClipRect;
  rect: ClipRect;
}

/** Computed focus styling of the engine cursor plus its paint region. */
function readFocus(p: Page): Promise<FocusVisuals | null> {
  return p.evaluate(() => {
    const el = document.querySelector<HTMLElement>('[data-focused="true"]');
    if (!el) return null;
    const cs = getComputedStyle(el);

    // `transform: none` means scale 1; otherwise the `a` of the matrix is the
    // x-scale (the focus style only ever scales uniformly).
    const scale = cs.transform === 'none' ? 1 : new DOMMatrixReadOnly(cs.transform).a;

    // Split the shadow list on top-level commas only: an `rgb(r, g, b)` color is
    // inside parens and must not split the layer.
    const layers = cs.boxShadow === 'none' ? [] : cs.boxShadow.split(/,(?![^(]*\))/);

    // Resolve the focus-ring token to the same `rgb(...)` form Chromium writes
    // into `box-shadow`.
    const probe = document.createElement('span');
    probe.style.color = 'var(--md-sys-color-focus-ring)';
    probe.style.position = 'absolute';
    probe.style.opacity = '0';
    document.body.append(probe);
    const ringRgb = getComputedStyle(probe).color;
    probe.remove();

    const r = el.getBoundingClientRect();
    let clip: ClipRect = {
      left: 0,
      top: 0,
      right: window.innerWidth,
      bottom: window.innerHeight,
    };
    let parent = el.parentElement;
    while (parent) {
      const style = getComputedStyle(parent);
      const overflow = `${style.overflow}${style.overflowX}${style.overflowY}`;
      if (/hidden|auto|scroll|clip/.test(overflow)) {
        const pr = parent.getBoundingClientRect();
        // `overflow: clip` viewports paint into `overflow-clip-margin` instead
        // of padding the content (see `focusRingClipStyle`).
        const margin = parseFloat(style.overflowClipMargin) || 0;
        clip = {
          left: pr.left - margin,
          top: pr.top - margin,
          right: pr.right + margin,
          bottom: pr.bottom + margin,
        };
        break;
      }
      parent = parent.parentElement;
    }

    return {
      isControl: el.classList.contains('tv-focus-target'),
      isKey: el.classList.contains('tv-key'),
      scale,
      shadow: cs.boxShadow,
      layers: layers.length,
      firstLayer: (layers[0] ?? '').trim(),
      ringRgb,
      transitionDuration: cs.transitionDuration,
      zIndex: cs.zIndex,
      clip,
      rect: { left: r.left, top: r.top, right: r.right, bottom: r.bottom },
    };
  });
}

/**
 * Reads the cursor once its 140ms focus transition has finished. Reading
 * mid-transition gives an interpolated scale (e.g. 1.043) and would make the
 * assertion timing-dependent instead of a statement about the resting style.
 */
async function readSettledFocus(p: Page): Promise<FocusVisuals | null> {
  await p
    .waitForFunction(
      () => {
        const el = document.querySelector('[data-focused="true"]');
        if (!el) return false;
        return el.getAnimations().every((animation) => animation.playState !== 'running');
      },
      null,
      { timeout: 3_000 }
    )
    .catch(() => {
      // Settling is only a hint; the assertions below stay the source of truth.
    });
  return readFocus(p);
}

/**
 * Asserts the computed focus styling: scale inside the expected band, the ring
 * as the first shadow layer in the ring colour, at least two more elevation
 * layers, the raised stacking order, and that the scaled box (plus the ring)
 * stays inside its paint region.
 */
async function expectFocusVisuals(
  p: Page,
  label: string,
  scaleBand: { min: number; max: number } = { min: BASE_SCALE_MIN, max: BASE_SCALE_MAX }
) {
  const v = await readSettledFocus(p);
  expect(v, `${label}: no [data-focused="true"] element`).not.toBeNull();
  const seen = v as FocusVisuals;

  expect(seen.isControl, `${label}: focused element is not a tv-focus-target`).toBe(true);
  expect(seen.scale, `${label}: focus scale was ${seen.scale}`).toBeGreaterThanOrEqual(scaleBand.min);
  expect(seen.scale, `${label}: focus scale was ${seen.scale}`).toBeLessThanOrEqual(scaleBand.max);

  // Ring: first layer, `0 0 0 3px` in the focus-ring colour.
  expect(seen.firstLayer, `${label}: first shadow layer is not the 3px ring`).toContain(
    '0px 0px 0px 3px'
  );
  expect(seen.firstLayer, `${label}: ring is not --md-sys-color-focus-ring`).toContain(seen.ringRgb);

  // Elevation: ring + contact shadow + cast shadow.
  expect(seen.layers, `${label}: expected ring + 2 elevation layers, got "${seen.shadow}"`)
    .toBeGreaterThanOrEqual(3);

  expect(seen.zIndex, `${label}: focused element is not raised above its neighbours`).toBe('20');

  // The painted (scaled) box plus the ring must stay inside the clip region,
  // i.e. `--focus-ring-pad` is big enough for this target.
  const ring = 4;
  expect(
    seen.rect.left - ring >= seen.clip.left - 1 &&
      seen.rect.right + ring <= seen.clip.right + 1 &&
      seen.rect.top - ring >= seen.clip.top - 1 &&
      seen.rect.bottom + ring <= seen.clip.bottom + 1,
    `${label}: scaled focus box ${JSON.stringify(seen.rect)} overhangs clip ${JSON.stringify(seen.clip)}`
  ).toBe(true);
}

const PROBE = 'data-focus-visuals-probe';

/** Marks the current focus cursor so it can be found again after it loses focus. */
async function markFocused(p: Page) {
  const marked = await p.evaluate((attr) => {
    document.querySelectorAll(`[${attr}]`).forEach((el) => el.removeAttribute(attr));
    const el = document.querySelector('[data-focused="true"]');
    el?.setAttribute(attr, '1');
    return el !== null;
  }, PROBE);
  expect(marked, 'no focus cursor to mark').toBe(true);
}

/** The scale must be released when focus leaves the element. */
async function expectScaleReleased(p: Page, label: string) {
  await expect
    .poll(
      async () =>
        p.evaluate((attr) => {
          const el = document.querySelector<HTMLElement>(`[${attr}="1"]`);
          if (!el) return 'missing';
          const transform = getComputedStyle(el).transform;
          return transform === 'none' ? 'released' : transform;
        }, PROBE),
      { timeout: 3_000, message: `${label}: focus scale was not released` }
    )
    .toBe('released');
}

/** Presses arrows until `predicate` matches the current engine cursor. */
async function focusUntil(p: Page, predicate: string, maxSteps = 24) {
  const keys = ['ArrowDown', 'ArrowRight', 'ArrowDown', 'ArrowLeft'];
  for (let i = 0; i < maxSteps; i += 1) {
    const hit = await p.evaluate((selector) => {
      const el = document.querySelector('[data-focused="true"]');
      // `matches` for the cursor itself, `querySelector` for "the cursor
      // contains this" (e.g. `[data-focused="true"] input`: the cursor is the
      // field wrapper, so the input is a descendant, not a match).
      return el ? el.matches(selector) || !!el.querySelector(selector) : false;
    }, predicate);
    if (hit) return;
    await p.keyboard.press(keys[i % keys.length]);
  }
  throw new Error(`could not reach a [data-focused="true"] ${predicate} in ${maxSteps} steps`);
}

async function openHome(p: Page) {
  await p.getByTestId('navigation-rail').getByRole('button', { name: 'Home' }).click();
  await expect(p.getByText('Featured Live')).toBeVisible({ timeout: 15_000 });
}

async function focusRail(p: Page) {
  await expect
    .poll(
      async () => {
        if (await p.evaluate(() => !!document.querySelector('[data-focused="true"]')?.closest('aside'))) {
          return true;
        }
        await p.keyboard.press('ArrowLeft');
        return false;
      },
      { timeout: 10_000, message: 'could not focus the navigation rail' }
    )
    .toBe(true);
}

test('navigation rail: scaled, ringed, elevated — then released on exit', async () => {
  await openHome(page);
  await focusRail(page);

  await expectFocusVisuals(page, 'rail destination');

  await markFocused(page);
  await page.keyboard.press('ArrowRight');
  await expectScaleReleased(page, 'rail destination');
});

test('home channel card: scaled, ringed, elevated', async () => {
  await openHome(page);
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('[data-hero-state="collapsed"]')).toBeVisible();
  await expectFocusVisuals(page, 'home channel card');
});

test('live TV grid card: scaled, ringed, elevated', async () => {
  await page.getByTestId('navigation-rail').getByRole('button', { name: 'Live TV' }).click();
  await expect(page.getByRole('heading', { name: 'All Channels' })).toBeVisible();
  await page.keyboard.press('ArrowRight'); // category rail -> channel grid
  await expectFocusVisuals(page, 'live TV grid card');
});

test('settings: tab tile, button and text field all carry the focus styling', async () => {
  await page.getByTestId('navigation-rail').getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByText('Settings & Configuration')).toBeVisible();

  // Entry target is the active tab tile, which lives in a horizontal scroll
  // viewport — the pad must keep its ring unclipped.
  await expectFocusVisuals(page, 'settings tab tile');

  // A shared `Button` (Appearance → Display Theme).
  await page.keyboard.press('ArrowDown');
  await expectFocusVisuals(page, 'settings theme button');

  // Network panel owns the only TextField in settings (custom proxy template).
  // Switch tabs from the keyboard: a mouse click leaves the engine cursor on a
  // tile that the panel switch unmounts, which strands focus.
  await page.keyboard.press('ArrowUp'); // theme button -> tab row
  for (let i = 0; i < 6; i += 1) {
    const inTab = await page.evaluate(() => {
      const el = document.querySelector('[data-focused="true"]');
      return el?.textContent?.includes('Network & CORS Proxy') ?? false;
    });
    if (inTab) break;
    await page.keyboard.press('ArrowRight');
  }
  await page.keyboard.press('Enter');
  await expect(page.getByText('Custom Proxy URL Template')).toBeVisible();

  await focusUntil(page, '[data-focused="true"] input', 8);
  // Fields are width-derived (the compact inline field is full-width), so they
  // take `.tv-flat`: ring + elevation, no scale that a fixed pad cannot cover.
  await expectFocusVisuals(page, 'settings text field', { min: 1, max: 1 });
});

test('virtual keyboard key keeps the larger --focus-scale-key', async () => {
  await openHome(page);
  // Yellow is the "focus search" command (ADR 026), so the engine cursor is on
  // the inline field before the modal opens. The launcher itself is a mouse
  // affordance; the modal is then reachable with the D-pad from the field.
  await pressColorKey(page, 'Yellow', 405);
  await focusUntil(page, '[data-focused="true"] input');
  await page.getByRole('button', { name: 'Remote Keyboard' }).first().click();
  await expect(page.getByRole('button', { name: 'Done / Submit' })).toBeVisible();

  await focusUntil(page, '[data-focused="true"].tv-key');
  const v = (await readSettledFocus(page)) as FocusVisuals;
  expect(v.isKey, 'virtual keyboard key must carry .tv-key').toBe(true);
  await expectFocusVisuals(page, 'virtual keyboard key', { min: KEY_SCALE_MIN, max: KEY_SCALE_MAX });

  await page.getByRole('button', { name: 'Close' }).click();
});

test('EPG programme cell: scaled, ringed, elevated', async () => {
  // Minimal guide fixture so the programme grid has real cells. This replaces
  // the active playlist, so it runs last.
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('AetherIptvDatabase');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const stores = ['playlists', 'channels', 'groups', 'epgSources', 'epgChannels', 'epgMappings', 'programs'];
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
            id: 'fv_pl',
            name: 'Focus Visuals Playlist',
            type: 'm3u',
            createdAt: now,
            lastSyncedAt: now,
            channelCount: 2,
            isActive: true,
          });

          const channelStore = tx.objectStore('channels');
          const programStore = tx.objectStore('programs');
          for (let c = 0; c < 2; c += 1) {
            channelStore.put({
              id: `fv_ch_${c}`,
              playlistId: 'fv_pl',
              name: `Focus Channel ${c}`,
              groupId: 'fv_g',
              groupName: 'Focus',
              streamUrl: 'https://example.invalid/s.m3u8',
              tvgId: `fv.${c}`,
              number: c + 1,
              isFavorite: false,
              isHidden: false,
              isLocked: false,
            });
            for (let prog = 0; prog < 3; prog += 1) {
              const start = dayStartMs + prog * 1_800_000;
              programStore.put({
                id: `fv_prog_${c}_${prog}`,
                channelId: `fv_ch_${c}`,
                tvgId: `fv.${c}`,
                sourceId: 'fv_src',
                start,
                stop: start + 1_800_000,
                title: `Focus Show ${c}-${prog}`,
                description: 'Focus visuals fixture',
              });
            }
          }

          tx.objectStore('epgSources').put({
            id: 'fv_src',
            playlistId: 'fv_pl',
            name: 'Focus Guide',
            kind: 'remote',
            enabled: true,
            priority: 0,
            lastUpdatedAt: now,
            channelCount: 2,
            programmeCount: 6,
          });

          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      })
  );

  await page.reload();
  await waitForAppReady(page);
  await page.getByTestId('navigation-rail').getByRole('button', { name: 'EPG Guide' }).click();
  await expect(page.getByText('Focus Show 0-0').first()).toBeVisible({ timeout: 15_000 });

  await focusUntil(page, '[data-focused="true"][data-scroll-x]');
  // Programme cells opt out of the scale via `.tv-flat`: their width is
  // unbounded (a two-hour programme is a very wide cell), so `w*(scale-1)/2`
  // can exceed any fixed `--focus-ring-pad`. They keep the ring and elevation.
  await expectFocusVisuals(page, 'EPG programme cell', { min: 1, max: 1 });
});

test('every top-level screen: focus paint box stays inside its clip region', async () => {
  // The audit behind `--focus-ring-pad`, `.tv-flat` and `--focus-scale-key`: walk
  // every stop on every screen and require the painted focus box (scaled rect +
  // ring) to fit the nearest clipping ancestor. A target that is too wide to
  // scale must opt into `.tv-flat` instead of silently painting outside its
  // viewport.
  const navButtons = page.locator('aside button');
  const count = await navButtons.count();
  expect(count).toBeGreaterThan(0);
  const directions = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'] as const;
  const violations: string[] = [];

  for (let n = 0; n < count; n += 1) {
    const screen = (await navButtons.nth(n).getAttribute('aria-label')) ?? `screen ${n}`;
    await navButtons.nth(n).click();
    await page.waitForTimeout(150);
    for (let i = 0; i < 8; i += 1) {
      await page.keyboard.press(directions[i % directions.length]);
      const v = await readSettledFocus(page);
      if (!v) {
        violations.push(`${screen} step ${i}: no focus cursor`);
        continue;
      }
      const ring = 4;
      const fits =
        v.rect.left - ring >= v.clip.left - 1 &&
        v.rect.right + ring <= v.clip.right + 1 &&
        v.rect.top - ring >= v.clip.top - 1 &&
        v.rect.bottom + ring <= v.clip.bottom + 1;
      if (!fits) {
        violations.push(
          `${screen} step ${i}: box ${JSON.stringify(v.rect)} vs clip ${JSON.stringify(v.clip)}`
        );
      }
      if (v.scale > 1.0001 && v.scale < BASE_SCALE_MIN) {
        violations.push(`${screen} step ${i}: unexpected scale ${v.scale}`);
      }
      if (!v.isControl) {
        violations.push(`${screen} step ${i}: focus cursor is not a tv-focus-target`);
      }
    }
  }

  expect(violations, violations.join('\n')).toEqual([]);
});

test.describe('prefers-reduced-motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('keeps the static focus cue and drops the transition', async ({ page: reduced }) => {
    await reduced.goto('/');
    await waitForAppReady(reduced);
    const getStarted = reduced.getByRole('button', { name: /Get Started/i });
    if (await getStarted.isVisible().catch(() => false)) {
      await reduced.keyboard.press('Enter');
      await reduced.keyboard.press('ArrowDown');
      await reduced.keyboard.press('ArrowRight');
      await reduced.keyboard.press('Enter');
    }
    await expect(reduced.getByText('Featured Live')).toBeVisible({ timeout: 15_000 });

    await focusRail(reduced);
    const v = (await readSettledFocus(reduced)) as FocusVisuals;
    expect(v.transitionDuration, 'reduced motion must drop the interpolation').toBe('0s');
    // A size/contrast cue, not motion: the scale and ring stay.
    expect(v.scale).toBeGreaterThanOrEqual(BASE_SCALE_MIN);
    expect(v.scale).toBeLessThanOrEqual(BASE_SCALE_MAX);
    expect(v.firstLayer).toContain('0px 0px 0px 3px');
    expect(v.layers).toBeGreaterThanOrEqual(3);
  });
});
