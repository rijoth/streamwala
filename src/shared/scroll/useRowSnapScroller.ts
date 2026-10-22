import { useCallback, useEffect, useRef } from 'react';
import { getCurrentFocusKey } from '../focus/index.ts';
import { ScrollConfig, resolveScrollConfig } from './config.ts';
import { clamp, rowSnapOffset } from './math.ts';
import { writeScrollMemory } from './scrollMemory.ts';
import { FocusedItemInfo, readFocusedItem, useFocusedItemIndex } from './useFocusedItemIndex.ts';
import { useLayoutSignal } from './useLayoutSignal.ts';
import { ScrollAxisApi, useScrollAxis } from './useScrollAxis.ts';
import { useScrollRestore } from './useScrollRestore.ts';

export interface RowSnapScrollerOptions {
  /** Memory slot / screen identifier. */
  screenKey: string;
  /** Number of `[data-scroll-row]` sections in the content. */
  rowCount: number;
  config?: Partial<ScrollConfig>;
  onFocusedRowChange?: (row: number) => void;
}

export interface RowSnapScroller {
  axis: ScrollAxisApi;
  config: ScrollConfig;
}

/**
 * Vertical page scroller: anchors the focused row's top on the focus line and
 * scrolls row by row, never pixel by pixel. The next row peeks below because the
 * focus line sits at ~38% of the viewport.
 *
 * The row's top is read from the live layout (`offsetTop` of the row element,
 * which ignores the content transform) instead of from a cached snapshot. A page
 * of rows is a handful of elements, so one layout read per focus change costs
 * nothing next to the paint the focus ring already forces — and it makes the
 * offset a pure function of what is on screen *now*. A cache could not express
 * the transitions this screen really has (the hero collapsing when focus leaves
 * it, an EPG/history row being inserted above the focused one), and a stale one
 * painted the focused row above the clip viewport (BUG-028).
 *
 * `useLayoutSignal` closes the same hole for changes that arrive without a focus
 * event: whenever the content's layout or the viewport size changes, the row
 * that currently holds focus is re-anchored, so it never drifts off the focus
 * line. The row index is re-read from the DOM at that point, because inserting a
 * row above the focused one renumbers it.
 */
export function useRowSnapScroller(options: RowSnapScrollerOptions): RowSnapScroller {
  const config = resolveScrollConfig(options.config);
  const configRef = useRef(config);
  configRef.current = config;

  const rowChangeRef = useRef(options.onFocusedRowChange);
  rowChangeRef.current = options.onFocusedRowChange;
  const screenKeyRef = useRef(options.screenKey);
  screenKeyRef.current = options.screenKey;
  const rowCountRef = useRef(options.rowCount);
  rowCountRef.current = options.rowCount;

  const axis = useScrollAxis({ orientation: 'vertical', config: options.config });
  const lastRowRef = useRef<number | null>(null);

  /** Live top of `row` in content coordinates (`offsetTop`, transform-free). */
  const rowTopFor = useCallback(
    (row: number): number => {
      const content = axis.contentRef.current;
      const element = content?.querySelector<HTMLElement>(`[data-scroll-row="${row}"]`);
      return element ? element.offsetTop : 0;
    },
    [axis]
  );

  /** Snap offset for `row`, or `null` while the viewport has no size yet. */
  const snapTargetFor = useCallback(
    (row: number): number | null => {
      const viewportSize = axis.getViewportSize();
      // `onSized` below re-anchors once the viewport is laid out, so a 0x0 size
      // model never pins the row to the top edge.
      if (viewportSize <= 0) return null;
      return rowSnapOffset(rowTopFor(row), viewportSize, axis.getContentSize(), configRef.current);
    },
    [axis, rowTopFor]
  );

  const commitRow = useCallback(
    (row: number): number => {
      const clampedRow = clamp(row, 0, Math.max(0, rowCountRef.current - 1));
      const target = snapTargetFor(clampedRow);
      // An unchanged target (e.g. a re-anchor triggered by an unrelated class
      // swap) must not restart the in-flight tween.
      if (target !== null && Math.abs(target - axis.getOffset()) > 0.5) {
        axis.scrollToOffset(target, { animate: true });
      }
      lastRowRef.current = clampedRow;
      rowChangeRef.current?.(clampedRow);
      writeScrollMemory(screenKeyRef.current, {
        focusKey: getCurrentFocusKey() ?? null,
        offset: target ?? axis.getOffset(),
        row: clampedRow,
      });
      return clampedRow;
    },
    [axis, snapTargetFor]
  );

  const handleFocusItem = useCallback(
    (info: FocusedItemInfo) => {
      commitRow(info.row);
    },
    [commitRow]
  );

  const reanchor = useCallback(() => {
    const info = readFocusedItem(axis.viewportRef.current);
    const row = info?.row ?? lastRowRef.current;
    if (row === null) return;
    commitRow(row);
  }, [axis, commitRow]);

  const contentTick = useLayoutSignal(axis.contentRef, { subtree: true });
  const viewportTick = useLayoutSignal(axis.viewportRef);
  useEffect(() => {
    reanchor();
  }, [contentTick, viewportTick, reanchor]);

  useEffect(() => axis.onSized(reanchor), [axis, reanchor]);

  useFocusedItemIndex(axis.viewportRef, handleFocusItem);
  useScrollRestore(options.screenKey, axis);

  return { axis, config };
}
