import { useCallback, useRef } from 'react';
import { getCurrentFocusKey } from '../focus/index.ts';
import { resolveScrollConfig, ScrollConfig } from './config.ts';
import { carouselOffset } from './math.ts';
import { writeScrollMemory } from './scrollMemory.ts';
import { FocusedItemInfo, useFocusedItemIndex } from './useFocusedItemIndex.ts';
import { ScrollAxisApi, useScrollAxis } from './useScrollAxis.ts';
import { useScrollRestore } from './useScrollRestore.ts';

export interface CarouselScrollerOptions {
  memoryKey?: string;
  /** Fixed card width in px (token-driven), never measured. */
  cardSize: number;
  /** Fixed gap between cards in px. */
  gap: number;
  config?: Partial<ScrollConfig>;
}

export interface CarouselScroller {
  axis: ScrollAxisApi;
  config: ScrollConfig;
}

/**
 * Horizontal carousel: focus moves across the visible cards until it reaches
 * `carouselSlot`, after which the strip slides so focus stays in that slot. No
 * wrap-around; both ends stop with the strip clamped.
 */
export function useCarouselScroller(options: CarouselScrollerOptions): CarouselScroller {
  const config = resolveScrollConfig(options.config);
  const configRef = useRef(config);
  configRef.current = config;
  const cardRef = useRef(options.cardSize);
  cardRef.current = options.cardSize;
  const gapRef = useRef(options.gap);
  gapRef.current = options.gap;
  const memoryKey = options.memoryKey ?? '';
  const memoryKeyRef = useRef(memoryKey);
  memoryKeyRef.current = memoryKey;

  const axis = useScrollAxis({ orientation: 'horizontal', config: options.config });

  const handleFocusItem = useCallback(
    (info: FocusedItemInfo) => {
      const target = carouselOffset(
        info.col,
        cardRef.current,
        gapRef.current,
        axis.getViewportSize(),
        axis.getContentSize(),
        configRef.current
      );
      axis.scrollToOffset(target, { animate: true });
      if (memoryKeyRef.current) {
        writeScrollMemory(memoryKeyRef.current, {
          focusKey: getCurrentFocusKey() ?? null,
          offset: target,
          row: info.row,
        });
      }
    },
    [axis]
  );

  useFocusedItemIndex(axis.viewportRef, handleFocusItem);
  useScrollRestore(memoryKey, axis);

  return { axis, config };
}
