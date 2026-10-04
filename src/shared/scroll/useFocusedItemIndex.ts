import { useEffect } from 'react';
import type React from 'react';

export interface FocusedItemInfo {
  /** Flat item index within the row/container that owns the focused element. */
  index: number;
  /** Row/section index (nearest `[data-scroll-row]` ancestor, default 0). */
  row: number;
  /** Column index within the row (from `data-scroll-col`, default 0). */
  col: number;
}

/**
 * Watches the focus engine's `data-focused="true"` marker inside a viewport and
 * reports the focused item's indices.
 *
 * Focus is the source of truth: the scroller derives its offset from this, not
 * from measuring the focused element. Only `data-focused` attribute changes
 * fire the observer, so there is no per-frame work.
 */
export function useFocusedItemIndex(
  viewportRef: React.RefObject<HTMLElement | null>,
  onFocusItem: (info: FocusedItemInfo) => void
): void {
  useEffect(() => {
    const root = viewportRef.current;
    if (!root || typeof MutationObserver === 'undefined') return;

    const read = () => {
      const focused = root.querySelector<HTMLElement>('[data-focused="true"]');
      if (!focused || !root.contains(focused)) return;
      const rowEl = focused.closest<HTMLElement>('[data-scroll-row]');
      const row = rowEl?.dataset.scrollRow !== undefined ? Number(rowEl.dataset.scrollRow) : 0;
      const index =
        focused.dataset.scrollIndex !== undefined ? Number(focused.dataset.scrollIndex) : row;
      const col = focused.dataset.scrollCol !== undefined ? Number(focused.dataset.scrollCol) : 0;
      onFocusItem({ index, row, col });
    };

    const observer = new MutationObserver(read);
    observer.observe(root, {
      subtree: true,
      attributes: true,
      attributeFilter: ['data-focused'],
    });
    read();
    return () => observer.disconnect();
  }, [viewportRef, onFocusItem]);
}
