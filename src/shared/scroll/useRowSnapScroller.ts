import { useCallback, useRef } from 'react';
import { getCurrentFocusKey } from '../focus/index.ts';
import { ScrollConfig, resolveScrollConfig } from './config.ts';
import { clamp, rowPrefixOffset, rowSnapOffset } from './math.ts';
import { writeScrollMemory } from './scrollMemory.ts';
import { FocusedItemInfo, useFocusedItemIndex } from './useFocusedItemIndex.ts';
import { useScrollAxis, ScrollAxisApi } from './useScrollAxis.ts';
import { useScrollRestore } from './useScrollRestore.ts';

export interface RowSnapScrollerOptions {
  /** Memory slot / screen identifier. */
  screenKey: string;
  /** Fixed height of each content row, in order (index math, no measurement). */
  rowSizes: number[];
  /** Leading in-flow padding before the first row (ring clearance etc.). */
  contentInset?: number;
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
 */
export function useRowSnapScroller(options: RowSnapScrollerOptions): RowSnapScroller {
  const config = resolveScrollConfig(options.config);
  const configRef = useRef(config);
  configRef.current = config;

  const rowSizesRef = useRef(options.rowSizes);
  rowSizesRef.current = options.rowSizes;
  const insetRef = useRef(options.contentInset ?? 0);
  insetRef.current = options.contentInset ?? 0;
  const rowChangeRef = useRef(options.onFocusedRowChange);
  rowChangeRef.current = options.onFocusedRowChange;
  const screenKeyRef = useRef(options.screenKey);
  screenKeyRef.current = options.screenKey;

  const axis = useScrollAxis({ orientation: 'vertical', config: options.config });

  const handleFocusItem = useCallback(
    (info: FocusedItemInfo) => {
      const sizes = rowSizesRef.current;
      const row = clamp(info.row, 0, Math.max(0, sizes.length - 1));
      const rowTop = insetRef.current + rowPrefixOffset(sizes, row);
      const target = rowSnapOffset(
        rowTop,
        axis.getViewportSize(),
        axis.getContentSize(),
        configRef.current
      );
      axis.scrollToOffset(target, { animate: true });
      rowChangeRef.current?.(row);
      writeScrollMemory(screenKeyRef.current, {
        focusKey: getCurrentFocusKey() ?? null,
        offset: axis.getOffset(),
        row,
      });
    },
    [axis]
  );

  useFocusedItemIndex(axis.viewportRef, handleFocusItem);
  useScrollRestore(options.screenKey, axis);

  return { axis, config };
}
