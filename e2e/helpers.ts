import { expect, type Page } from '@playwright/test';

/**
 * Waits for the cold-boot splash to leave the document (ADR 022).
 *
 * Specs that act on the first frame after a navigation or a reload should use
 * this instead of a content sentinel: the splash is held for a minimum display
 * time and replaces itself when boot settles, so anything pressed during it is
 * deliberately ignored.
 */
export async function waitForAppReady(page: Page): Promise<void> {
  await expect(page.getByTestId('app-splash')).toHaveCount(0);
}

/**
 * Colour keys cannot be pressed by name in Playwright, so dispatch the same
 * keyboard event a TV remote sends (`key` + deprecated `keyCode`).
 */
export async function pressColorKey(
  page: Page,
  key: 'Red' | 'Green' | 'Yellow' | 'Blue',
  keyCode: number
): Promise<void> {
  await page.evaluate(
    ({ key, keyCode }) => {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      Object.defineProperty(event, 'keyCode', { get: () => keyCode });
      window.dispatchEvent(event);
    },
    { key, keyCode }
  );
}
