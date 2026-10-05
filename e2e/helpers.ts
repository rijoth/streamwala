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
