import { useEffect, useState } from 'react';
import type React from 'react';

/**
 * Measures the leading edges of `[data-scroll-item]` elements along one axis,
 * relative to the positioned content element. Layout-pass only; the hot path
 * uses the cached offsets as index math for strips with variable item sizes.
 */
export function useItemOffsets(
  containerRef: React.RefObject<HTMLElement | null>,
  axis: 'x' | 'y',
  itemCount: number
): number[] {
  const [offsets, setOffsets] = useState<number[]>([]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const measure = () => {
      const elements = Array.from(root.querySelectorAll<HTMLElement>('[data-scroll-item]'));
      const next = elements.map((el) => (axis === 'x' ? el.offsetLeft : el.offsetTop));
      setOffsets((prev) =>
        prev.length === next.length && prev.every((value, index) => value === next[index])
          ? prev
          : next
      );
    };

    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    Array.from(root.querySelectorAll<HTMLElement>('[data-scroll-item]')).forEach((el) =>
      observer.observe(el)
    );
    return () => observer.disconnect();
  }, [containerRef, axis, itemCount]);

  return offsets;
}
