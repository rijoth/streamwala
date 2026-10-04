import { useCallback, useRef } from 'react';
import { getCurrentFocusKey } from '../focus/index.ts';
import { resolveScrollConfig, ScrollConfig } from './config.ts';
import { gridColumns, minimalScrollOffset, rowForIndex } from './math.ts';
import { writeScrollMemory } from './scrollMemory.ts';
import { FocusedItemInfo, useFocusedItemIndex } from './useFocusedItemIndex.ts';
import { useElementWidth } from './useElementWidth.ts';
import { useMeasuredItemHeight } from './useMeasuredItemHeight.ts';
import { ScrollAxisApi, useScrollAxis } from './useScrollAxis.ts';
import { useScrollRestore } from './useScrollRestore.ts';

export interface GridScrollerOptions {
  screenKey: string;
  /** Total number of items (grids/lists can be 100k+). */
  count: number;
  /**
   * Fallback row height in px (item height + gap). Only used for the first paint
   * when `measureItemHeight` is on; after that the first rendered cell decides.
   */
  rowSize: number;
  /** Minimum item width used to derive the column count. */
  minItemWidth: number;
  /** Fixed gap in px. */
  gap: number;
  /** Force a column count (e.g. list view = 1); otherwise derived from width. */
  columns?: number;
  maxColumns?: number;
  /**
   * Derive the row height from the first rendered cell instead of trusting
   * `rowSize`. Required when item heights are authored in rem and therefore
   * track the viewer's font size, so index math cannot drift from layout
   * (BUG-022).
   */
  measureItemHeight?: boolean;
  config?: Partial<ScrollConfig>;
}

export interface GridScroller {
  axis: ScrollAxisApi;
  config: ScrollConfig;
  columns: number;
  /** Item height in px, measured when `measureItemHeight` is enabled. */
  itemHeight: number;
  /** Item height + gap in px; the scroller's index-math row pitch. */
  rowSize: number;
}

/**
 * Minimal-scroll scroller for grids and long lists.
 *
 * Nothing moves until focus is within `edgeMargin` rows of the viewport edge,
 * then it scrolls exactly enough to restore the margin. Columns are derived
 * from the viewport width with index math, so the rendered range and the offset
 * model always agree.
 */
export function useGridScroller(options: GridScrollerOptions): GridScroller {
  const config = resolveScrollConfig(options.config);
  const configRef = useRef(config);
  configRef.current = config;
  const screenKeyRef = useRef(options.screenKey);
  screenKeyRef.current = options.screenKey;

  const axis = useScrollAxis({ orientation: 'vertical', config: options.config });
  const width = useElementWidth(axis.viewportRef);

  const fallbackItemHeight = Math.max(0, options.rowSize - options.gap);
  const measuredItemHeight = useMeasuredItemHeight(
    axis.contentRef,
    options.measureItemHeight === true
  );
  const itemHeight = measuredItemHeight ?? fallbackItemHeight;
  const rowSize = itemHeight + options.gap;

  const rowSizeRef = useRef(rowSize);
  rowSizeRef.current = rowSize;

  const columns = options.columns
    ? Math.max(1, options.columns)
    : gridColumns(width, options.minItemWidth, options.gap, options.maxColumns ?? 8);
  const columnsRef = useRef(columns);
  columnsRef.current = columns;

  const handleFocusItem = useCallback(
    (info: FocusedItemInfo) => {
      const row = rowForIndex(info.index, columnsRef.current);
      const target = minimalScrollOffset(
        axis.getOffset(),
        row,
        rowSizeRef.current,
        axis.getViewportSize(),
        axis.getContentSize(),
        configRef.current
      );
      axis.scrollToOffset(target, { animate: true });
      writeScrollMemory(screenKeyRef.current, {
        focusKey: getCurrentFocusKey() ?? null,
        offset: target,
        row,
      });
    },
    [axis]
  );

  useFocusedItemIndex(axis.viewportRef, handleFocusItem);
  useScrollRestore(options.screenKey, axis);

  return { axis, config, columns, itemHeight, rowSize };
}

