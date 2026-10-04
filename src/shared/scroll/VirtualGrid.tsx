import React from 'react';
import { gridRows } from './math.ts';
import type { ScrollAxisApi } from './useScrollAxis.ts';
import { useVirtualWindow } from './useVirtualWindow.ts';

export interface VirtualGridProps<T> {
  axis: ScrollAxisApi;
  items: T[];
  /** Columns currently laid out (computed from viewport width). */
  columns: number;
  /** Fixed item height in px. */
  itemHeight: number;
  /** Fixed gap in px. */
  gap: number;
  overscanRows?: number;
  className?: string;
  getKey: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => React.ReactNode;
}

/**
 * Windowed grid driven by the scroll axis offset.
 *
 * The content element keeps the full index-math height so clamping stays
 * correct for 100k items, while only the visible rows (plus overscan) are
 * rendered. The leading spacer is a transform, so focus never shifts under the
 * focused item when the window changes.
 */
export function VirtualGrid<T>({
  axis,
  items,
  columns,
  itemHeight,
  gap,
  overscanRows = 2,
  className = '',
  getKey,
  renderItem,
}: VirtualGridProps<T>) {
  const rowSize = itemHeight + gap;
  const totalRows = gridRows(items.length, columns);
  const { start, end } = useVirtualWindow(axis, rowSize, totalRows, overscanRows);
  const startIndex = start * columns;
  const endIndex = Math.min(items.length, end * columns);
  const slice = items.slice(startIndex, endIndex);

  return (
    <div ref={axis.contentRef} className={`relative ${className}`} style={{ height: totalRows * rowSize }}>
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gap,
          transform: `translateY(${start * rowSize}px)`,
        }}
      >
        {slice.map((item, offset) => (
          <div key={getKey(item, startIndex + offset)}>{renderItem(item, startIndex + offset)}</div>
        ))}
      </div>
    </div>
  );
}
