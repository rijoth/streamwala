import {
  init,
  setFocus as noriginSetFocus,
  getCurrentFocusKey as noriginGetCurrentFocusKey,
  doesFocusableExist as noriginDoesFocusableExist,
} from '@noriginmedia/norigin-spatial-navigation';

let isInitialized = false;

export function initFocusEngine() {
  if (isInitialized) return;
  
  try {
    init({
      debug: false,
      visualDebug: false,
      distanceCalculationMethod: 'center',
      shouldFocusDOMNode: true,
    });
    isInitialized = true;
  } catch (err) {
    console.error('Failed to initialize spatial navigation engine:', err);
  }
}

// Auto-initialize immediately on module load so that any focusable components
// mounting during initial render have this.layoutAdapter defined and ready.
if (typeof window !== 'undefined') {
  initFocusEngine();
}

export function setFocus(focusKey: string) {
  try {
    noriginSetFocus(focusKey);
  } catch (err) {
    console.warn(`Failed to set focus to ${focusKey}:`, err);
  }
}

export function getCurrentFocusKey() {
  return noriginGetCurrentFocusKey();
}

/** True when a focusable with `focusKey` is currently registered with the engine. */
export function focusKeyExists(focusKey: string): boolean {
  try {
    return noriginDoesFocusableExist(focusKey);
  } catch {
    return false;
  }
}
