import { useCallback, useRef } from 'react';
import { getCurrentFocusKey } from '../focus/index.ts';
import { resolveScrollConfig } from './config.ts';
import { clamp, maxOffset } from './math.ts';
import { writeScrollMemory } from './scrollMemory.ts';
import { FocusedItemInfo, useFocusedItemIndex } from './useFocusedItemIndex.ts';
import { useItemOffsets } from './useItemOffsets.ts';
import { ScrollAxisApi, useScrollAxis } from './useScrollAxis.ts';
import { useScrollRestore } from './useScrollRestore.ts';

export interface StripScrollerOptions {
  memoryKey?: string;
  itemCount: number;
  /** Leading inset kept inside the viewport for the focused item. */
  anchor?: number;
  config?: Parameters<typeof resolveScrollConfig>[0];
}

export interface StripScroller {
  axis: ScrollAxisApi;
}

/**
 * Horizontal strip for items with *variable* widths (filter chips). Item leading
 * edges are cached on layout and the focused item is anchored near the leading
 * edge; there is no wrap-around and both ends clamp.
 */
export function useStripScroller(options: StripScrollerOptions): StripScroller {
  const anchorRef = useRef(options.anchor ?? 0);
  anchorRef.current = options.anchor ?? 0;
  const memoryKey = options.memoryKey ?? '';
  const memoryKeyRef = useRef(memoryKey);
  memoryKeyRef.current = memoryKey;

  const axis = useScrollAxis({ orientation: 'horizontal', config: options.config });
  const offsets = useItemOffsets(axis.contentRef, 'x', options.itemCount);
  const offsetsRef = useRef(offsets);
  offsetsRef.current = offsets;

  const handleFocusItem = useCallback(
    (info: FocusedItemInfo) => {
      const left = offsetsRef.current[info.col] ?? 0;
      const target = clamp(
        left - anchorRef.current,
        0,
        maxOffset(axis.getContentSize(), axis.getViewportSize())
      );
      axis.scrollToOffset(target, { animate: true });
      if (memoryKeyRef.current) {
        writeScrollMemory(memoryKeyRef.current, {
          focusKey: getCurrentFocusKey() ?? null,
          offset: target,
          row: info.col,
        });
      }
    },
    [axis]
  );

  useFocusedItemIndex(axis.viewportRef, handleFocusItem);
  useScrollRestore(memoryKey, axis);

  return { axis };
}
