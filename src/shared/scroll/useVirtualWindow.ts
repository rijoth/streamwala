import { useEffect, useState } from 'react';
import { visibleRange } from './math.ts';
import type { ScrollAxisApi } from './useScrollAxis.ts';

export interface VirtualWindow {
  start: number;
  end: number;
}

/**
 * Controlled windowing driven by the scroll axis offset.
 *
 * Returns the item range that must be rendered. The range only changes on row
 * boundaries, so a smooth scroll does not re-render on every frame. Keys remain
 * stable (`items.slice(start, end)`) and content is never inserted above the
 * focused item.
 */
export function useVirtualWindow(
  axis: ScrollAxisApi,
  itemSize: number,
  count: number,
  overscan: number
): VirtualWindow {
  const [window, setWindow] = useState<VirtualWindow>(() => ({
    start: 0,
    end: Math.min(count, Math.max(1, overscan)),
  }));

  useEffect(() => {
    const compute = (offset: number) =>
      visibleRange(offset, axis.getViewportSize(), itemSize, count, overscan);

    const update = (offset: number) => {
      const next = compute(offset);
      setWindow((prev) => (prev.start === next.start && prev.end === next.end ? prev : next));
    };

    update(axis.getOffset());
    const unsubscribe = axis.subscribe(update);
    return unsubscribe;
  }, [axis, itemSize, count, overscan]);

  return window;
}
