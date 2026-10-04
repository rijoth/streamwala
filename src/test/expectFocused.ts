import { expect } from 'vitest';
import { getCurrentFocusKey } from '../shared/focus/index.ts';

/** Asserts that the spatial-navigation engine's current focus key is `focusKey`. */
export function expectFocused(focusKey: string): void {
  expect(getCurrentFocusKey()).toBe(focusKey);
}