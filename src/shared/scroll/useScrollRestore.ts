import { useEffect } from 'react';
import { focusKeyExists, setFocus } from '../focus/index.ts';
import { readScrollMemory } from './scrollMemory.ts';
import type { ScrollAxisApi } from './useScrollAxis.ts';

/**
 * Restores the remembered offset and focus key for a memory slot once the
 * viewport has a measurable size.
 *
 * The offset is applied first so the windowing primitive renders the remembered
 * row, then focus is set (on the next frame if the target is not rendered yet).
 * This restores the exact row/card after the player, a dialog or a route change
 * with no visible jump.
 */
export function useScrollRestore(memoryKey: string, axis: ScrollAxisApi): void {
  useEffect(() => {
    const entry = readScrollMemory(memoryKey);
    if (!entry) return;

    const restoreFocus = () => {
      if (!entry.focusKey) return;
      if (focusKeyExists(entry.focusKey)) {
        setFocus(entry.focusKey);
        return;
      }
      requestAnimationFrame(() => {
        if (entry.focusKey && focusKeyExists(entry.focusKey)) setFocus(entry.focusKey);
      });
    };

    const restore = () => {
      if (entry.offset > 0) axis.setPendingOffset(entry.offset);
      restoreFocus();
    };

    if (axis.isSized()) {
      restore();
      return;
    }
    return axis.onSized(restore);
  }, [memoryKey, axis]);
}
