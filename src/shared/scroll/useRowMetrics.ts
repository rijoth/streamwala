import { useEffect, useState } from 'react';
import type React from 'react';

/**
 * Caches each `[data-scroll-row]` section's top offset (relative to the
 * positioned content element) for row-snap math.
 *
 * Measurement happens only on mount and on resize (a layout pass), never while
 * focus moves; the hot path uses the cached tops as index math. This keeps
 * determinism ("same layout -> same offsets") while allowing rows of different
 * heights and inter-row gaps.
 */
export function useRowMetrics(
  containerRef: React.RefObject<HTMLElement | null>,
  rowCount: number,
  deps: unknown[] = []
): number[] {
  const [rowTops, setRowTops] = useState<number[]>(() => new Array(rowCount).fill(0));

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const measure = () => {
      const elements = Array.from(root.querySelectorAll<HTMLElement>('[data-scroll-row]'));
      const next = elements.map((el) => el.offsetTop);
      setRowTops((prev) =>
        prev.length === next.length && prev.every((value, index) => value === next[index])
          ? prev
          : next
      );
    };

    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    Array.from(root.querySelectorAll<HTMLElement>('[data-scroll-row]')).forEach((el) =>
      observer.observe(el)
    );
    return () => observer.disconnect();
  }, [containerRef, rowCount, ...deps]);

  return rowTops;
}
