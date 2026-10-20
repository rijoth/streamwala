import { useEffect } from 'react';
import { focusKeyExists, setFocus } from '../focus/index.ts';
import { isEditableElement } from '../input/useTvInput.ts';
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
 *
 * Focus is never stolen from a text input: clearing an inline search query
 * remounts the browse rows while the viewer is still typing, and a restore
 * would yank the caret out of the field. The offset is still restored, so
 * clearing the query reveals the remembered position once focus leaves the
 * field.
 *
 * `enabled: false` skips the restore entirely (search result grids, whose
 * content is query-derived and must always start at the top).
 */
export function useScrollRestore(
  memoryKey: string,
  axis: ScrollAxisApi,
  enabled = true
): void {
  useEffect(() => {
    if (!enabled) return;
    const entry = readScrollMemory(memoryKey);
    if (!entry) return;

    const restoreFocus = () => {
      if (!entry.focusKey) return;
      if (isEditableElement(document.activeElement)) return;
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
  }, [memoryKey, axis, enabled]);
}
