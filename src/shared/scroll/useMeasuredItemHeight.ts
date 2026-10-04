import { useEffect, useState } from 'react';
import type React from 'react';

/**
 * Real rendered height (px) of a virtualized cell, or `null` before the first
 * measurement.
 *
 * Grid/list item heights are authored in rem so the 10-foot typography scales
 * with the viewer's font size, but the scroller's index math needs px. Measuring
 * the first rendered cell keeps layout and math in sync for any root font size,
 * browser zoom or font-metric difference (BUG-022). Measurement runs on a layout
 * pass only — mirroring `useRowMetrics` — so the focus hot path stays pure index
 * math.
 */
export function useMeasuredItemHeight(
  contentRef: React.RefObject<HTMLElement | null>,
  enabled: boolean,
  deps: unknown[] = []
): number | null {
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const root = contentRef.current;
    if (!root) return;

    const firstCell = () => root.querySelector<HTMLElement>('[data-scroll-index]');

    const measure = () => {
      const cell = firstCell();
      if (!cell) return;
      // `offsetHeight` ignores the focused card's `scale(1.04)` transform.
      const next = cell.offsetHeight;
      if (next <= 0) return;
      setHeight((prev) => (prev === next ? prev : next));
    };

    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    const cell = firstCell();
    if (cell) observer.observe(cell);
    // A changed root font size resizes the content element (rows are rem-based).
    observer.observe(root);
    return () => observer.disconnect();
  }, [contentRef, enabled, ...deps]);

  return height;
}
