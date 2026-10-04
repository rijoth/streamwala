import { useCallback, useRef } from 'react';
import { getCurrentFocusKey } from '../focus/index.ts';
import { resolveScrollConfig, ScrollConfig } from './config.ts';
import { minimalScrollOffset, rowForIndex } from './math.ts';
import { writeScrollMemory } from './scrollMemory.ts';
import { FocusedItemInfo, useFocusedItemIndex } from './useFocusedItemIndex.ts';
import { ScrollAxisApi, useScrollAxis } from './useScrollAxis.ts';
import { useScrollRestore } from './useScrollRestore.ts';

export interface GridScrollerOptions {
  screenKey: string;
  /** Total number of items (grids/lists can be 100k+). */
  count: number;
  /** Columns currently laid out; changes with the viewport width. */
  columns: number;
  /** Fixed row height in px. */
  rowSize: number;
  config?: Partial<ScrollConfig>;
}

export interface GridScroller {
  axis: ScrollAxisApi;
  config: ScrollConfig;
}

/**
 * Minimal-scroll scroller for grids and long lists.
 *
 * Nothing moves until focus is within `edgeMargin` rows of the viewport edge,
 * then it scrolls exactly enough to restore the margin. Avoids constant motion
 * and stays cheap on low-end SoCs.
 */
export function useGridScroller(options: GridScrollerOptions): GridScroller {
  const config = resolveScrollConfig(options.config);
  const configRef = useRef(config);
  configRef.current = config;
  const columnsRef = useRef(options.columns);
  columnsRef.current = Math.max(1, options.columns);
  const rowSizeRef = useRef(options.rowSize);
  rowSizeRef.current = options.rowSize;
  const screenKeyRef = useRef(options.screenKey);
  screenKeyRef.current = options.screenKey;

  const axis = useScrollAxis({ orientation: 'vertical', config: options.config });

  const handleFocusItem = useCallback(
    (info: FocusedItemInfo) => {
      const columns = columnsRef.current;
      const row = rowForIndex(info.index, columns);
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
