import React, { useMemo } from 'react';
import { Channel } from '../../domain/types.ts';
import { FocusZone, useFocusable } from '../../shared/focus/index.ts';
import { Button } from '../../shared/ui/index.ts';
import { Icon } from '../../shared/icons/index.ts';
import { ScrollPositionIndicator, VirtualGrid, useGridScroller } from '../../shared/scroll/index.ts';

export interface FavoritesViewProps {
  channels: Channel[];
  onSelectChannel: (channel: Channel) => void;
  onToggleFavorite: (channelId: string) => void;
  onGoToLive: () => void;
}

const FAVORITE_ITEM_HEIGHT = 208;
const FAVORITE_ITEM_MIN_HEIGHT = '13rem';
const FAVORITE_GAP = 16;

export const FavoritesView: React.FC<FavoritesViewProps> = ({
  channels,
  onSelectChannel,
  onToggleFavorite,
  onGoToLive,
}) => {
  const favorites = useMemo(() => channels.filter((c) => c.isFavorite), [channels]);

  const { axis, columns, itemHeight, rowSize } = useGridScroller({
    screenKey: 'favorites',
    count: favorites.length,
    rowSize: FAVORITE_ITEM_HEIGHT + FAVORITE_GAP,
    minItemWidth: 180,
    gap: FAVORITE_GAP,
    maxColumns: 5,
    // Cards are rem-sized, so the row pitch must come from the rendered cell.
    measureItemHeight: true,
  });
  const totalRows = Math.max(1, Math.ceil(favorites.length / Math.max(1, columns)));

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden p-6 text-[var(--md-sys-color-on-surface)]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Favorite Channels</h2>
          <p className="text-xs text-[var(--md-sys-color-outline)]">
            Your pinned channels for instant 10-foot remote access.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ScrollPositionIndicator axis={axis} itemSize={rowSize} count={totalRows} />
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 bg-amber-950/40 border border-amber-800/60 px-3 py-1.5 rounded-full">
            <Icon name="star" size={16} filled />
            <span>{favorites.length} Pinned</span>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {favorites.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center text-[var(--md-sys-color-outline)]">
            <div className="w-16 h-16 rounded-2xl bg-[var(--md-sys-color-surface-container)] flex items-center justify-center mb-3">
              <Icon name="star_outline" size={32} />
            </div>
            <h3 className="font-semibold text-lg text-[var(--md-sys-color-on-surface)]">
              No favorites pinned yet
            </h3>
            <p className="text-sm max-w-sm mt-1 mb-6">
              Browse channels in Live TV and press the Star button or Red remote key to pin your
              favorites here.
            </p>
            <Button variant="filled" icon="live_tv" autoFocus onClick={onGoToLive}>
              Browse Channels
            </Button>
          </div>
        ) : (
          <FocusZone focusKey="FAVORITES_GRID" className="h-full">
            <div ref={axis.viewportRef} data-scroll-axis="vertical" className="relative h-full overflow-hidden">
              <VirtualGrid<Channel>
                axis={axis}
                items={favorites}
                columns={columns}
                itemHeight={itemHeight}
                gap={FAVORITE_GAP}
                className="px-[var(--focus-ring-pad)]"
                getKey={(channel) => channel.id}
                renderItem={(channel) => (
                  <FavoriteCard
                    channel={channel}
                    onSelect={() => onSelectChannel(channel)}
                    onToggleFavorite={() => onToggleFavorite(channel.id)}
                  />
                )}
              />
            </div>
          </FocusZone>
        )}
      </div>
    </div>
  );
};

interface FavoriteCardProps {
  channel: Channel;
  onSelect: () => void;
  onToggleFavorite: () => void;
}

const FavoriteCard: React.FC<FavoriteCardProps> = ({ channel, onSelect, onToggleFavorite }) => {
  const { ref, focused } = useFocusable({
    focusKey: `FAVORITES_${channel.id}`,
    onEnterPress: onSelect,
  });

  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      onClick={onSelect}
      style={{ minHeight: FAVORITE_ITEM_MIN_HEIGHT }}
      className={`
        tv-focus-target group relative rounded-2xl p-4 flex flex-col items-center text-center cursor-pointer outline-none overflow-hidden
        bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)]
        ${focused ? 'tv-focused ring-3 ring-[var(--md-sys-color-focus-ring)] !bg-[var(--md-sys-color-primary-container)] !border-[var(--md-sys-color-primary)] z-10' : ''}
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
          className="p-1 text-amber-400 hover:text-red-400 cursor-pointer"
        >
          <Icon name="star" size={18} filled />
        </button>
      </div>

      <div className="w-18 h-18 rounded-2xl bg-[var(--md-sys-color-surface-container-highest)] p-2 flex items-center justify-center mb-2 shrink-0">
        {channel.logo ? (
          <img
            src={channel.logo}
            alt={channel.name}
            className="w-full h-full object-contain"
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
      <p className="text-[11px] text-[var(--md-sys-color-outline)] truncate w-full mt-0.5">
        {channel.groupName}
      </p>
    </div>
  );
};
