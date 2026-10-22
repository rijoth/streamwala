import React from 'react';
import { Channel } from '../../domain/types.ts';
import { FocusZone, useFocusable } from '../../shared/focus/index.ts';
import { Icon } from '../../shared/icons/index.ts';
import { useDesignPx } from '../../shared/utils/designPx.ts';
import {
  ScrollPositionIndicator,
  VirtualGrid,
  useFocusRingClipStyle,
  gridRows,
  useGridScroller,
} from '../../shared/scroll/index.ts';
import { useSearchFocusGuard } from './useSearchFocusGuard.ts';

const SEARCH_ITEM_HEIGHT = 192;
const SEARCH_ITEM_MIN_HEIGHT = '10.5rem';
const SEARCH_GAP = 16;

const RESULT_FOCUS_PREFIXES = ['HOME_SEARCH_RESULT_'] as const;

export interface SearchResultsGridProps {
  channels: Channel[];
  query: string;
  onSelectChannel: (channel: Channel) => void;
  onToggleFavorite: (channelId: string) => void;
}

/**
 * Home search results. Replaces the hero + rows while a query is active.
 *
 * The VirtualGrid is always mounted, even with zero items, so `contentRef`
 * stays attached to the layout pass and the empty state can be an overlay
 * instead of a different tree. Results never auto-focus (BUG-003).
 */
export const SearchResultsGrid: React.FC<SearchResultsGridProps> = ({
  channels,
  query,
  onSelectChannel,
  onToggleFavorite,
}) => {
  const designPx = useDesignPx();
  const clipStyle = useFocusRingClipStyle();
  const gap = SEARCH_GAP * designPx;
  const { axis, config, columns, itemHeight, rowSize } = useGridScroller({
    screenKey: 'home:search',
    count: channels.length,
    rowSize: SEARCH_ITEM_HEIGHT * designPx + gap,
    minItemWidth: 180 * designPx,
    gap,
    maxColumns: 5,
    // Cards are rem-sized, so the row pitch must come from the rendered cell.
    measureItemHeight: true,
    // A query-derived list always starts at the top.
    restore: false,
  });

  useSearchFocusGuard({
    items: channels,
    isSearching: true,
    fieldFocusKey: 'HOME_SEARCH_FIELD',
    resultFocusPrefixes: RESULT_FOCUS_PREFIXES,
    axis,
    columns,
    rowSize,
    config,
  });

  const totalRows = Math.max(1, gridRows(channels.length, columns));

  return (
    <div className="flex-1 min-h-0 flex flex-col px-8 pb-6">
      <div className="flex items-center gap-3 py-3 min-h-[1.25rem] text-sm text-[var(--md-sys-color-outline)] px-1">
        <span>
          Found {channels.length} matching {channels.length === 1 ? 'channel' : 'channels'}
        </span>
        <ScrollPositionIndicator axis={axis} itemSize={rowSize} count={totalRows} />
      </div>

      <FocusZone focusKey="HOME_SEARCH_RESULTS" className="relative flex-1 min-h-0">
        <div
          ref={axis.viewportRef}
          data-testid="home-search-viewport"
          data-scroll-axis="vertical"
          className="relative h-full overflow-hidden"
          style={clipStyle}
        >
          <VirtualGrid<Channel>
            axis={axis}
            items={channels}
            columns={columns}
            itemHeight={itemHeight}
            gap={gap}
            className="px-[var(--focus-ring-pad)]"
            getKey={(channel) => channel.id}
            renderItem={(channel, index) => (
              <SearchResultCard
                channel={channel}
                index={index}
                onSelect={() => onSelectChannel(channel)}
                onToggleFavorite={() => onToggleFavorite(channel.id)}
              />
            )}
          />

          {channels.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-[var(--md-sys-color-outline)] pointer-events-none">
              <Icon name="search_off" size={48} className="mb-2 opacity-40" />
              <p className="text-base font-semibold">
                {query.trim() ? `No channels match “${query.trim()}”` : 'No matching channels found'}
              </p>
            </div>
          )}
        </div>
      </FocusZone>
    </div>
  );
};

interface SearchResultCardProps {
  channel: Channel;
  index: number;
  onSelect: () => void;
  onToggleFavorite: () => void;
}

/**
 * Result card. `data-scroll-index` is what the scroller measures and reads for
 * index math, so it must track the flat position in the filtered list.
 */
export const SearchResultCard: React.FC<SearchResultCardProps> = ({
  channel,
  index,
  onSelect,
  onToggleFavorite,
}) => {
  const { ref, focused } = useFocusable({
    focusKey: `HOME_SEARCH_RESULT_${channel.id}`,
    onEnterPress: onSelect,
  });

  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      onClick={onSelect}
      data-scroll-index={index}
      data-channel-id={channel.id}
      style={{ minHeight: SEARCH_ITEM_MIN_HEIGHT }}
      className={`
        tv-focus-target group relative rounded-2xl p-4 flex flex-col items-center text-center cursor-pointer outline-none overflow-hidden
        bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)]
        ${focused ? 'tv-focused z-10' : ''}
      `}
    >
      <div className="w-full flex items-center justify-between mb-2">
        <span className="font-mono text-xs font-bold text-[var(--md-sys-color-primary)]">
          {typeof channel.number === 'number' && !Number.isNaN(channel.number) ? channel.number : '•'}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          className="p-1 text-[var(--md-sys-color-outline)] hover:text-[var(--sw-status-favorite)] cursor-pointer"
        >
          <Icon name="star" size={16} filled={channel.isFavorite} className={channel.isFavorite ? 'text-[var(--sw-status-favorite)]' : ''} />
        </button>
      </div>

      <div
        data-logo-plate="xl"
        className="w-[var(--logo-size-xl)] h-[var(--logo-size-xl)] rounded-xl bg-[var(--md-sys-color-surface-container-highest)] flex items-center justify-center mb-2 shrink-0"
      >
        {channel.logo ? (
          <img
            src={channel.logo}
            alt={channel.name}
            className="w-[80%] h-[80%] object-contain"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        ) : (
          <span className="font-bold text-sm text-[var(--md-sys-color-primary)]">
            {channel.name.slice(0, 2)}
          </span>
        )}
      </div>

      <h4 className="font-bold text-sm truncate w-full text-[var(--md-sys-color-on-surface)]">
        {channel.name}
      </h4>
      <p className="text-[0.6875rem] text-[var(--md-sys-color-outline)] truncate w-full mt-0.5">
        {channel.groupName}
      </p>
    </div>
  );
};
