import { useEffect } from 'react';
import type React from 'react';

export interface FocusedItemInfo {
  /** Flat item index within the row/container that owns the focused element. */
  index: number;
  /** Row/section index (nearest `[data-scroll-row]` ancestor, default 0). */
  row: number;
  /** Column index within the row (from `data-scroll-col`, default 0). */
  col: number;
  /** Leading edge along a secondary axis (`data-scroll-x`), when provided. */
  x: number;
}

/**
 * Reads the indices of the focused item inside `root`, or `null` when nothing
 * inside it holds focus.
 *
 * Shared by the focus observer and by the re-anchoring path: when the layout
 * above the focused row changes, the focused *element* stays the source of
 * truth, so its row index is re-read from the DOM instead of trusting the index
 * recorded by the last focus event (a row inserted above shifts the index).
 */
export function readFocusedItem(root: HTMLElement | null): FocusedItemInfo | null {
  if (!root) return null;
  const focused = root.querySelector<HTMLElement>('[data-focused="true"]');
  if (!focused || !root.contains(focused)) return null;
  const rowEl = focused.closest<HTMLElement>('[data-scroll-row]');
  const itemEl = focused.closest<HTMLElement>('[data-scroll-item]');
  const itemIndex =
    itemEl?.dataset.scrollItem !== undefined ? Number(itemEl.dataset.scrollItem) : undefined;
  const row = rowEl?.dataset.scrollRow !== undefined ? Number(rowEl.dataset.scrollRow) : 0;
  const index =
    focused.dataset.scrollIndex !== undefined
      ? Number(focused.dataset.scrollIndex)
      : itemIndex ?? row;
  const col =
    focused.dataset.scrollCol !== undefined ? Number(focused.dataset.scrollCol) : itemIndex ?? 0;
  const x = focused.dataset.scrollX !== undefined ? Number(focused.dataset.scrollX) : 0;
  return { index, row, col, x };
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
      const info = readFocusedItem(root);
      if (info) onFocusItem(info);
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
