import { useEffect } from 'react';
import { focusKeyExists, setFocus } from '../focus/index.ts';
import { readScrollMemory } from './scrollMemory.ts';
import type { ScrollAxisApi } from './useScrollAxis.ts';

/**
 * Restores the remembered focus key and offset for a memory slot once the
 * viewport has a measurable size. Focus is restored first, so the row-snap /
 * minimal-scroll logic re-derives the deterministic offset on top of the
 * remembered one.
 */
export function useScrollRestore(memoryKey: string, axis: ScrollAxisApi): void {
  useEffect(() => {
    const entry = readScrollMemory(memoryKey);
    if (!entry) return;

    const restore = () => {
      if (entry.focusKey && focusKeyExists(entry.focusKey)) {
        setFocus(entry.focusKey);
      }
      if (entry.offset > 0) {
        axis.setPendingOffset(entry.offset);
      }
    };

    if (axis.isSized()) {
      restore();
      return;
    }
    return axis.onSized(restore);
  }, [memoryKey, axis]);
}
