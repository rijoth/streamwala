import { focusKeyExists } from './spatial.ts';

/**
 * Remembers the last content (non-rail) focus key so the navigation rail can
 * restore the user to the exact card/button they came from.
 *
 * The rail owns no content state: the shell feeds this memory on every remote
 * press while focus is inside content, and the rail reads it when the D-pad
 * moves RIGHT / activates the already-active destination.
 */
let lastContentFocusKey: string | null = null;

export const RAIL_FOCUS_KEY = 'NAV_RAIL';
const RAIL_ITEM_PREFIX = 'NAV_';

/** True when a focus key belongs to the navigation rail rather than content. */
export function isRailFocusKey(focusKey: string | null | undefined): boolean {
  return typeof focusKey === 'string' && focusKey.startsWith(RAIL_ITEM_PREFIX);
}

export function rememberContentFocus(focusKey: string | null | undefined): void {
  if (focusKey && !isRailFocusKey(focusKey)) {
    lastContentFocusKey = focusKey;
  }
}

/** Returns the remembered content key only while it is still mounted. */
export function recallContentFocus(): string | null {
  if (lastContentFocusKey && focusKeyExists(lastContentFocusKey)) {
    return lastContentFocusKey;
  }
  return null;
}

export function clearContentFocusMemory(): void {
  lastContentFocusKey = null;
}
