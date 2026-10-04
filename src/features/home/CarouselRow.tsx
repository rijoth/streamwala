import React from 'react';
import { Channel } from '../../domain/types.ts';
import { FocusZone } from '../../shared/focus/index.ts';
import { Icon } from '../../shared/icons/index.ts';
import {
  ScrollViewport,
  useCarouselScroller,
} from '../../shared/scroll/index.ts';
import { ChannelTile, HOME_CARD_GAP, HOME_CARD_SIZE } from './ChannelTile.tsx';

export interface CarouselRowProps {
  /** Vertical row index, used by the page scroller to snap this row. */
  rowIndex: number;
  memoryKey: string;
  focusKey: string;
  title: string;
  icon: string;
  iconClass: string;
  items: Channel[];
  onSelect: (channel: Channel) => void;
  action?: { label: string; onClick: () => void };
}

/**
 * A horizontal Home rail: fixed card metrics, fixed focus slot, a peeking next
 * card and a trailing edge fade. The strip never wraps.
 */
export const CarouselRow: React.FC<CarouselRowProps> = ({
  rowIndex,
  memoryKey,
  focusKey,
  title,
  icon,
  iconClass,
  items,
  onSelect,
  action,
}) => {
  const { axis } = useCarouselScroller({
    memoryKey,
    cardSize: HOME_CARD_SIZE,
    gap: HOME_CARD_GAP,
  });

  return (
    <section data-scroll-row={rowIndex} className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <Icon name={icon} size={22} className={iconClass} />
          <span>{title}</span>
        </h2>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="text-xs text-[var(--md-sys-color-primary)] hover:underline font-semibold"
          >
            {action.label}
          </button>
        )}
      </div>

      <FocusZone focusKey={focusKey} className="relative">
        <ScrollViewport
          api={axis}
          testId={`carousel-${focusKey}`}
          contentClassName="flex items-center gap-4 px-[var(--focus-ring-pad)] py-3"
        >
          {items.map((channel, index) => (
            <ChannelTile
              key={channel.id}
              channel={channel}
              index={index}
              focusKey={`${focusKey}_${channel.id}`}
              onSelect={() => onSelect(channel)}
            />
          ))}
        </ScrollViewport>
        {/* Subtle trailing edge fade: gradient mask only, no blur. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-10 rounded-r-2xl bg-gradient-to-l from-[var(--md-sys-color-surface-dim)] to-transparent"
        />
      </FocusZone>
    </section>
  );
};
