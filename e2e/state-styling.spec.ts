import { test, expect, type Page, type Locator } from '@playwright/test';
import { waitForAppReady } from './helpers.ts';

/**
 * The four interaction states are visually distinct (ADR 030).
 *
 * The bug being guarded against: focus, selected tabs, primary actions and
 * secondary actions all shared one light-blue colour, so a viewer at 3 metres
 * could not tell which element the D-pad was on, what was selected, or what was
 * the main action. This spec reads `getComputedStyle` and asserts:
 *
 * 1. focus is a near-white outline that never borrows the accent, and survives
 *    on a filled primary action;
 * 2. selected is an accent tint + accent label + 3px marker, not a solid fill,
 *    and stays visible together with the focus ring;
 * 3. primary is a solid accent fill with the dark `on-accent` label;
 * 4. secondary is the neutral tonal surface, not the accent;
 *
 * with the exact token values resolved from `src/index.css` at runtime.
 */
test.describe.configure({ mode: 'serial' });

let page: Page;

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  page = await context.newPage();
  await page.goto('/');
  await waitForAppReady(page);
  const getStarted = page.getByRole('button', { name: /Get Started/i });
  if (await getStarted.isVisible().catch(() => false)) {
    await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect(page.getByText('Featured Live')).toBeVisible({ timeout: 15_000 });
  }
  await page.getByTestId('navigation-rail').getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByText('Settings & Configuration')).toBeVisible();
});

test.afterAll(async () => {
  await page.context().close();
});

/** Resolves a CSS custom property to the `rgb(...)` Chromium reports. */
function tokenRgb(p: Page, name: string): Promise<string> {
  return p.evaluate((token) => {
    const probe = document.createElement('span');
    probe.style.color = `var(${token})`;
    probe.style.position = 'absolute';
    probe.style.opacity = '0';
    document.body.append(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  }, name);
}

interface StateStyle {
  background: string;
  color: string;
  classes: string;
  outlineColor: string;
  outlineWidth: string;
  outlineOffset: string;
  marker: { height: string; width: string; background: string } | null;
}

function readStyle(p: Page, selector: string): Promise<StateStyle | null> {
  return p.evaluate((sel) => {
    const el = document.querySelector<HTMLElement>(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    const marker = getComputedStyle(el, '::after');
    return {
      background: cs.backgroundColor,
      color: cs.color,
      classes: el.className,
      outlineColor: cs.outlineColor,
      outlineWidth: cs.outlineWidth,
      outlineOffset: cs.outlineOffset,
      marker:
        marker.content && marker.content !== 'none'
          ? { height: marker.height, width: marker.width, background: marker.backgroundColor }
          : null,
    };
  }, selector);
}

async function styleOf(locator: Locator): Promise<StateStyle | null> {
  const handle = await locator.elementHandle();
  if (!handle) return null;
  const id = `state-probe-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await handle.evaluate((el, attr) => el.setAttribute(attr, '1'), id);
  const style = await readStyle(page, `[${id}="1"]`);
  await handle.evaluate((el, attr) => el.removeAttribute(attr), id);
  return style;
}

const focusedSelector = '[data-focused="true"]';

test('selected tab: accent tint + accent label + 3px marker, and both cues with focus', async () => {
  const [ring, accentText, selected, selectedFocused, accentFill] = await Promise.all([
    tokenRgb(page, '--sw-focus-ring'),
    tokenRgb(page, '--sw-accent-text'),
    tokenRgb(page, '--sw-surface-selected'),
    tokenRgb(page, '--sw-surface-selected-focus'),
    tokenRgb(page, '--sw-accent-primary'),
  ]);

  // The active tab is the entry focus target, so this is selected + focused.
  const tab = await readStyle(page, `${focusedSelector}.state-selected`);
  expect(tab, 'no focused selected tab').not.toBeNull();
  const seen = tab as StateStyle;

  expect(seen.classes).toContain('state-selected-underline');
  // Selected surface is the accent tint, never the solid accent fill.
  expect(seen.background).not.toBe(accentFill);
  expect([selected, selectedFocused]).toContain(seen.background);
  // Accent-coloured label, not the dark on-accent label.
  expect(seen.color).toBe(accentText);
  // Persistent marker.
  expect(seen.marker, 'selected tab has no marker').not.toBeNull();
  expect((seen.marker as { height: string }).height).toBe('3px');
  expect((seen.marker as { background: string }).background).toBe(accentText);
  // Focus cue is the near-white ring, offset, and independent of the accent.
  expect(seen.outlineWidth).toBe('3px');
  expect(seen.outlineOffset).toBe('4px');
  expect(seen.outlineColor).toBe(ring);
  expect(seen.outlineColor).not.toBe(accentFill);
});

test('primary action: solid accent fill with dark label, one visible definition', async () => {
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Add New Source' })).toBeVisible();

  const [accentFill, onAccent, secondarySurface] = await Promise.all([
    tokenRgb(page, '--sw-accent-primary'),
    tokenRgb(page, '--sw-on-accent-primary'),
    tokenRgb(page, '--sw-surface-secondary'),
  ]);

  const add = await styleOf(page.getByRole('button', { name: 'Add New Source' }));
  expect(add, 'Add New Source button missing').not.toBeNull();
  expect((add as StateStyle).classes).toContain('action-primary');
  expect((add as StateStyle).background).toBe(accentFill);
  expect((add as StateStyle).color).toBe(onAccent);
  expect((add as StateStyle).background).not.toBe(secondarySurface);

  // Focus must not replace the primary fill with the neutral focus surface: the
  // ring and scale carry the cue instead.
  for (let i = 0; i < 12; i += 1) {
    const onAdd = await page.evaluate(() => {
      const el = document.querySelector('[data-focused="true"]');
      return el?.textContent?.includes('Add New Source') ?? false;
    });
    if (onAdd) break;
    await page.keyboard.press('ArrowDown');
  }
  await expect
    .poll(() => page.evaluate(() => document.querySelector('[data-focused="true"]')?.textContent ?? ''))
    .toContain('Add New Source');
  const focusedAdd = await readStyle(page, focusedSelector);
  expect((focusedAdd as StateStyle).background).toBe(accentFill);
  expect((focusedAdd as StateStyle).outlineColor).toBe(await tokenRgb(page, '--sw-focus-ring'));
});

test('secondary action: neutral tonal surface, never the accent', async () => {
  const [secondarySurface, onSecondary, accentFill, ring] = await Promise.all([
    tokenRgb(page, '--sw-surface-secondary'),
    tokenRgb(page, '--sw-on-surface-secondary'),
    tokenRgb(page, '--sw-accent-primary'),
    tokenRgb(page, '--sw-focus-ring'),
  ]);

  const refresh = await styleOf(page.getByRole('button', { name: 'Refresh' }).first());
  expect(refresh, 'Refresh button missing').not.toBeNull();
  const seen = refresh as StateStyle;
  expect(seen.classes).toContain('action-secondary');
  expect(seen.background).toBe(secondarySurface);
  expect(seen.background).not.toBe(accentFill);
  expect(seen.color).toBe(onSecondary);

  // Focus still uses the ring token when it is not on the element.
  expect(ring).not.toBe(accentFill);
});

test('semantic colours are not derived from the accent', async () => {
  const [accent, active, favorite, live] = await Promise.all([
    tokenRgb(page, '--sw-accent-primary'),
    tokenRgb(page, '--sw-status-active'),
    tokenRgb(page, '--sw-status-favorite'),
    tokenRgb(page, '--sw-status-live'),
  ]);

  expect(active).not.toBe(accent);
  expect(favorite).not.toBe(accent);
  expect(live).not.toBe(accent);
  expect(new Set([active, favorite, live]).size).toBe(3);
});

test('switching to light and AMOLED keeps the four states distinct', async () => {
  for (const theme of ['Light Mode', 'AMOLED Pure Black'] as const) {
    await page.getByRole('button', { name: 'Appearance & TV Safe Area' }).click();
    await page.getByRole('button', { name: theme }).click();
    const [ring, accentFill, selected, secondary] = await Promise.all([
      tokenRgb(page, '--sw-focus-ring'),
      tokenRgb(page, '--sw-accent-primary'),
      tokenRgb(page, '--sw-surface-selected'),
      tokenRgb(page, '--sw-surface-secondary'),
    ]);
    expect(ring, `${theme}: ring must not be the accent`).not.toBe(accentFill);
    expect(selected, `${theme}: selected must not be the primary fill`).not.toBe(accentFill);
    expect(secondary, `${theme}: secondary must not be the primary fill`).not.toBe(accentFill);
    expect(selected, `${theme}: selected must differ from secondary`).not.toBe(secondary);
  }
});

test('every selected marker is anchored to its own control', async () => {
  // Regression: without `position: relative` on the host, the absolutely
  // positioned marker anchored to the nearest positioned ancestor and painted
  // under the last item in the rail instead of the selected one.
  await page.getByTestId('navigation-rail').getByRole('button', { name: 'Live TV' }).click();
  await expect(page.getByRole('heading', { name: 'All Channels' })).toBeVisible();

  const marker = await page.evaluate(() => {
    const host = document.querySelector<HTMLElement>(
      '[data-testid="category-rail"] [aria-current="true"]'
    );
    if (!host) return null;
    const after = getComputedStyle(host, '::after');
    return {
      hostPosition: getComputedStyle(host).position,
      content: after.content,
      height: after.height,
      bottom: after.bottom,
    };
  });

  expect(marker, 'no selected category in the rail').not.toBeNull();
  expect((marker as { hostPosition: string }).hostPosition).toBe('relative');
  expect((marker as { content: string }).content).not.toBe('none');
  expect((marker as { height: string }).height).toBe('3px');
  // Anchored to the bottom edge of its own control, not an ancestor.
  expect((marker as { bottom: string }).bottom).toBe('4px');
});
