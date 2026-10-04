import { useEffect, useRef, useState } from 'react';
import { visibleRange } from './math.ts';
import type { ScrollAxisApi } from './useScrollAxis.ts';

export interface ScrollPositionIndicatorProps {
  axis: ScrollAxisApi;
  /** Fixed item size along the axis (row height or card width). */
  itemSize: number;
  count: number;
  className?: string;
}

/**
 * Thin, non-focusable position track for long lists. Hidden entirely when the
 * content fits in the viewport. It never takes focus and never announces, so
 * the existing `aria-live` behaviour is unchanged.
 */
export const ScrollPositionIndicator: React.FC<ScrollPositionIndicatorProps> = ({
  axis,
  itemSize,
  count,
  className = '',
}) => {
  const [state, setState] = useState({ start: 1, end: 0, total: count, visible: false });

  const itemSizeRef = useRef(itemSize);
  itemSizeRef.current = itemSize;
  const countRef = useRef(count);
  countRef.current = count;

  useEffect(() => {
    const update = (offset: number) => {
      const viewport = axis.getViewportSize();
      const total = countRef.current;
      const size = itemSizeRef.current;
      const range = visibleRange(offset, viewport, size, total, 0);
      setState((prev) => {
        const next = {
          start: range.start + 1,
          end: range.end,
          total,
          visible: viewport > 0 && total * size > viewport + 1,
        };
        return prev.start === next.start &&
          prev.end === next.end &&
          prev.total === next.total &&
          prev.visible === next.visible
          ? prev
          : next;
      });
    };
    update(axis.getOffset());
    return axis.subscribe(update);
  }, [axis]);

  if (!state.visible) return null;

  const fraction = state.total > 0 ? state.start / state.total : 0;
  const width = state.total > 0 ? Math.max(6, (100 * (state.end - state.start + 1)) / state.total) : 0;

  return (
    <div
      aria-hidden="true"
      data-testid="scroll-position-indicator"
      className={`flex items-center gap-3 text-xs text-[var(--md-sys-color-outline)] ${className}`}
    >
      <span className="font-mono tabular-nums">
        {state.start} / {state.total.toLocaleString()}
      </span>
      <div className="relative h-1 w-24 rounded-full overflow-hidden bg-[var(--md-sys-color-surface-container-highest)]">
        <div
          className="absolute inset-y-0 rounded-full bg-[var(--md-sys-color-primary)]"
          style={{ left: `${fraction * 100}%`, width: `${width}%` }}
        />
      </div>
    </div>
  );
};
