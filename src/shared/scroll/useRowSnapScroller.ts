import { useCallback, useEffect, useRef } from 'react';
import { getCurrentFocusKey } from '../focus/index.ts';
import { ScrollConfig, resolveScrollConfig } from './config.ts';
import { clamp, rowSnapOffset } from './math.ts';
import { writeScrollMemory } from './scrollMemory.ts';
import { FocusedItemInfo, useFocusedItemIndex } from './useFocusedItemIndex.ts';
import { ScrollAxisApi, useScrollAxis } from './useScrollAxis.ts';
import { useScrollRestore } from './useScrollRestore.ts';
import { useRowMetrics } from './useRowMetrics.ts';

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
 * Row tops are cached layout metrics (measured on mount/resize only) and then
 * used as index math in the hot path.
 */
export function useRowSnapScroller(options: RowSnapScrollerOptions): RowSnapScroller {
  const config = resolveScrollConfig(options.config);
  const configRef = useRef(config);
  configRef.current = config;

  const rowChangeRef = useRef(options.onFocusedRowChange);
  rowChangeRef.current = options.onFocusedRowChange;
  const screenKeyRef = useRef(options.screenKey);
  screenKeyRef.current = options.screenKey;

  const axis = useScrollAxis({ orientation: 'vertical', config: options.config });
  const rowTops = useRowMetrics(axis.contentRef, options.rowCount);
  const rowTopsRef = useRef(rowTops);
  rowTopsRef.current = rowTops;
  const lastRowRef = useRef<number | null>(null);

  const snapToRow = useCallback(
    (row: number) => {
      const tops = rowTopsRef.current;
      const clampedRow = clamp(row, 0, Math.max(0, tops.length - 1));
      const rowTop = tops[clampedRow] ?? 0;
      const target = rowSnapOffset(
        rowTop,
        axis.getViewportSize(),
        axis.getContentSize(),
        configRef.current
      );
      axis.scrollToOffset(target, { animate: true });
      return clampedRow;
    },
    [axis]
  );

  const handleFocusItem = useCallback(
    (info: FocusedItemInfo) => {
      const row = snapToRow(info.row);
      lastRowRef.current = row;
      rowChangeRef.current?.(row);
      const tops = rowTopsRef.current;
      const rowTop = tops[row] ?? 0;
      writeScrollMemory(screenKeyRef.current, {
        focusKey: getCurrentFocusKey() ?? null,
        offset: rowSnapOffset(rowTop, axis.getViewportSize(), axis.getContentSize(), configRef.current),
        row,
      });
    },
    [axis, snapToRow]
  );

  // Row layout changes when the hero collapses/expands: re-anchor the last
  // focused row so the content under focus does not jump.
  useEffect(() => {
    if (lastRowRef.current === null) return;
    snapToRow(lastRowRef.current);
  }, [rowTops, snapToRow]);

  useFocusedItemIndex(axis.viewportRef, handleFocusItem);
  useScrollRestore(options.screenKey, axis);

  return { axis, config };
}
