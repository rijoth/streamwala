import React, { useMemo } from 'react';
import { Channel } from '../../domain/types.ts';
import { FocusZone, useFocusable } from '../../shared/focus/index.ts';
import { useChannelSearch } from '../../shared/hooks/useChannelSearch.ts';
import { Button } from '../../shared/ui/index.ts';
import { Icon } from '../../shared/icons/index.ts';
import { useDesignPx } from '../../shared/utils/designPx.ts';
import {
  ScrollPositionIndicator,
  VirtualGrid,
  useFocusRingClipStyle,
  useGridScroller,
} from '../../shared/scroll/index.ts';
import { SearchField, useSearchFocusGuard } from '../search/index.ts';

export interface FavoritesViewProps {
  channels: Channel[];
  onSelectChannel: (channel: Channel) => void;
  onToggleFavorite: (channelId: string) => void;
  onGoToLive: () => void;
}

const FAVORITE_ITEM_HEIGHT = 200;
const FAVORITE_ITEM_MIN_HEIGHT = '13rem';
const FAVORITE_GAP = 16;

const RESULT_FOCUS_PREFIXES = ['FAVORITES_'] as const;

export const FavoritesView: React.FC<FavoritesViewProps> = ({
  channels,
  onSelectChannel,
  onToggleFavorite,
  onGoToLive,
}) => {
  const favorites = useMemo(() => channels.filter((c) => c.isFavorite), [channels]);
  const { query, setQuery, isSearching, results } = useChannelSearch(favorites);
  const displayFavorites = isSearching ? results : favorites;

  const designPx = useDesignPx();
  const clipStyle = useFocusRingClipStyle();
  const gap = FAVORITE_GAP * designPx;
  const { axis, config, columns, itemHeight, rowSize } = useGridScroller({
    screenKey: 'favorites',
    count: displayFavorites.length,
    rowSize: FAVORITE_ITEM_HEIGHT * designPx + gap,
    minItemWidth: 180 * designPx,
    gap,
    maxColumns: 5,
    // Cards are rem-sized, so the row pitch must come from the rendered cell.
    measureItemHeight: true,
  });

  useSearchFocusGuard({
    items: displayFavorites,
    isSearching,
    fieldFocusKey: 'FAVORITES_SEARCH_FIELD',
    resultFocusPrefixes: RESULT_FOCUS_PREFIXES,
    axis,
    columns,
    rowSize,
    config,
  });

  const totalRows = Math.max(1, Math.ceil(displayFavorites.length / Math.max(1, columns)));

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden p-6 text-[var(--md-sys-color-on-surface)]">
      <div className="flex items-start justify-between gap-6 mb-3">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold tracking-tight">Favorite Channels</h2>
          <p className="text-xs text-[var(--md-sys-color-outline)]">
            Your pinned channels for instant 10-foot remote access.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <ScrollPositionIndicator axis={axis} itemSize={rowSize} count={totalRows} />
          <div className="flex items-center gap-2 text-xs font-semibold status-favorite-surface border px-3 py-1.5 rounded-full">
            <Icon name="star" size={16} filled />
            <span>{isSearching ? `${displayFavorites.length} Match` : `${favorites.length} Pinned`}</span>
          </div>
        </div>
      </div>

      <SearchField
        focusKey="FAVORITES_SEARCH_FIELD"
        value={query}
        onChange={setQuery}
        label="Search favorites"
        placeholder="Search pinned channels by name, number or category"
        className="mb-6 max-w-xl mx-auto"
      />

      <div className="flex-1 min-h-0">
        <FocusZone focusKey="FAVORITES_GRID" className="h-full">
          <div
            ref={axis.viewportRef}
            data-testid="favorites-viewport"
            data-scroll-axis="vertical"
            className="relative h-full overflow-hidden"
            style={clipStyle}
          >
            <VirtualGrid<Channel>
              axis={axis}
              items={displayFavorites}
              columns={columns}
              itemHeight={itemHeight}
              gap={gap}
                className="px-[var(--focus-ring-pad)]"
              getKey={(channel) => channel.id}
              renderItem={(channel, index) => (
                <FavoriteCard
                  channel={channel}
                  index={index}
                  onSelect={() => onSelectChannel(channel)}
                  onToggleFavorite={() => onToggleFavorite(channel.id)}
                />
              )}
            />

            {favorites.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-[var(--md-sys-color-outline)]">
                <div className="w-16 h-16 rounded-2xl bg-[var(--md-sys-color-surface-container)] flex items-center justify-center mb-3">
                  <Icon name="star_outline" size={32} />
                </div>
                <h3 className="font-semibold text-lg text-[var(--md-sys-color-on-surface)]">
                  No favorites pinned yet
                </h3>
                <p className="text-sm max-w-sm mt-1 mb-6">
                  Focus a channel in Live TV or the Guide and press the Red remote key — or use the
                  Star button on its card — to pin it here.
                </p>
                <Button variant="filled" icon="live_tv" autoFocus={!isSearching} onClick={onGoToLive}>
                  Browse Channels
                </Button>
              </div>
            )}

            {favorites.length > 0 && displayFavorites.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-[var(--md-sys-color-outline)] pointer-events-none">
                <Icon name="search_off" size={48} className="mb-2 opacity-40" />
                <h3 className="font-semibold text-lg text-[var(--md-sys-color-on-surface)]">
                  No favorites match your search
                </h3>
                <p className="text-sm max-w-sm mt-1">
                  Nothing pinned matches “{query.trim()}”. Clear the search to see all favorites.
                </p>
              </div>
            )}
          </div>
        </FocusZone>
      </div>
    </div>
  );
};

interface FavoriteCardProps {
  channel: Channel;
  index: number;
  onSelect: () => void;
  onToggleFavorite: () => void;
}

const FavoriteCard: React.FC<FavoriteCardProps> = ({
  channel,
  index,
  onSelect,
  onToggleFavorite,
}) => {
  const { ref, focused } = useFocusable({
    focusKey: `FAVORITES_${channel.id}`,
    onEnterPress: onSelect,
  });

  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      onClick={onSelect}
      data-scroll-index={index}
      data-channel-id={channel.id}
      style={{ minHeight: FAVORITE_ITEM_MIN_HEIGHT }}
      className={`
        tv-focus-target group relative rounded-2xl p-4 flex flex-col items-center text-center cursor-pointer outline-none overflow-hidden
        bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)]
        ${focused ? 'tv-focused z-10' : ''}
      `}
    >
      <div className="w-full flex items-center justify-between mb-2">
        <span className="font-mono text-xs font-bold text-[var(--md-sys-color-primary)]">
          CH {typeof channel.number === 'number' && !Number.isNaN(channel.number) ? channel.number : '•'}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          className="p-1 text-[var(--sw-status-favorite)] hover:text-[var(--md-sys-color-error)] cursor-pointer"
        >
          <Icon name="star" size={18} filled />
        </button>
      </div>

      <div
        data-logo-plate="2xl"
        className="w-[var(--logo-size-2xl)] h-[var(--logo-size-2xl)] rounded-2xl bg-[var(--md-sys-color-surface-container-highest)] flex items-center justify-center mb-2 shrink-0"
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
          <span className="font-bold text-base text-[var(--md-sys-color-primary)]">
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
