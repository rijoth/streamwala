import React from 'react';
import { Channel } from '../../domain/types.ts';
import { useFocusable } from '../../shared/focus/index.ts';
import { Icon } from '../../shared/icons/index.ts';
import { useNowNext } from '../../app/epgRuntime.tsx';

/**
 * Card heights are authored in rem so the 10-foot typography scales with the
 * viewer's font size; `overflow-hidden` must never crop the channel name. The
 * px constants below are only the first-paint fallback for the scroller's index
 * math — the live value is measured from the rendered cell (BUG-022).
 */
export const CHANNEL_GRID_ITEM_MIN_HEIGHT = '13rem';
export const CHANNEL_LIST_ITEM_MIN_HEIGHT = '4rem';
export const CHANNEL_GRID_ITEM_HEIGHT = 224;
export const CHANNEL_LIST_ITEM_HEIGHT = 70;
export const CHANNEL_GAP = 16;

interface ChannelItemProps {
  channel: Channel;
  index: number;
  focusKey: string;
  onSelect: () => void;
  onToggleFavorite: () => void;
}

/** Rem-sized grid card. Height is uniform per row so index math stays exact. */
export const ChannelGridCard: React.FC<ChannelItemProps> = ({
  channel,
  index,
  focusKey,
  onSelect,
  onToggleFavorite,
}) => {
  const { ref, focused } = useFocusable({ focusKey, onEnterPress: onSelect });

  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      data-scroll-index={index}
      data-channel-id={channel.id}
      onClick={onSelect}
      style={{ minHeight: CHANNEL_GRID_ITEM_MIN_HEIGHT }}
      className={`
        tv-focus-target group relative rounded-2xl p-4 flex flex-col items-center text-center cursor-pointer outline-none overflow-hidden
        bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)]
        ${focused ? 'tv-focused z-10' : ''}
      `}
    >
      <div className="w-full flex items-center justify-between mb-3 text-xs">
        <span className="font-mono font-bold text-[var(--md-sys-color-primary)] bg-[var(--md-sys-color-surface-container-highest)] px-2 py-0.5 rounded-lg">
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
          <Icon name="star" size={18} filled={channel.isFavorite} className={channel.isFavorite ? 'text-[var(--sw-status-favorite)]' : ''} />
        </button>
      </div>

      <div
        data-logo-plate="2xl"
        className="w-[var(--logo-size-2xl)] h-[var(--logo-size-2xl)] mb-3 flex items-center justify-center rounded-2xl bg-[var(--md-sys-color-surface-container-highest)] shrink-0"
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
          <div className="w-full h-full rounded-xl bg-[var(--md-sys-color-surface-container-highest)] flex items-center justify-center font-bold text-xl text-[var(--md-sys-color-primary)]">
            {channel.name.slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>

      <h4 className="font-bold text-base truncate w-full text-[var(--md-sys-color-on-surface)]">
        {channel.name}
      </h4>
      <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] truncate w-full mt-0.5">
        {channel.groupName}
      </p>
    </div>
  );
};

/** Rem-sized list row. */
export const ChannelListItem: React.FC<ChannelItemProps> = ({
  channel,
  index,
  focusKey,
  onSelect,
  onToggleFavorite,
}) => {
  const { ref, focused } = useFocusable({ focusKey, onEnterPress: onSelect });
  const { current, progress } = useNowNext(channel.id);

  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      data-scroll-index={index}
      data-channel-id={channel.id}
      onClick={onSelect}
      style={{ minHeight: CHANNEL_LIST_ITEM_MIN_HEIGHT }}
      className={`
        tv-focus-target group flex items-center gap-4 p-3 rounded-2xl cursor-pointer outline-none overflow-hidden
        bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)]
        ${focused ? 'tv-focused z-10' : ''}
      `}
    >
      <span className="font-mono font-bold text-base w-10 text-center text-[var(--md-sys-color-primary)]">
        {typeof channel.number === 'number' && !Number.isNaN(channel.number) ? channel.number : '•'}
      </span>

      <div
        data-logo-plate="md"
        className="w-[var(--logo-size-md)] h-[var(--logo-size-md)] rounded-xl bg-[var(--md-sys-color-surface-container-highest)] flex items-center justify-center shrink-0"
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
            {channel.name.slice(0, 2).toUpperCase()}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-base truncate text-[var(--md-sys-color-on-surface)]">
          {channel.name}
        </h4>
        <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] truncate">
          {channel.groupName}
        </p>
        <div className="mt-1">
          <p className="text-[0.6875rem] truncate text-[var(--md-sys-color-on-surface-variant)]">
            {current?.title ?? 'No program information'}
          </p>
          <div className="h-1 mt-1 w-32 rounded-full bg-[var(--md-sys-color-surface-container-highest)] overflow-hidden">
            <div
              className="h-full bg-[var(--md-sys-color-primary)]"
              style={{ width: `${current ? Math.round(progress * 100) : 0}%` }}
            />
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite();
        }}
        className="p-2 text-[var(--md-sys-color-outline)] hover:text-[var(--sw-status-favorite)] cursor-pointer"
      >
        <Icon name="star" size={20} filled={channel.isFavorite} className={channel.isFavorite ? 'text-[var(--sw-status-favorite)]' : ''} />
      </button>
    </div>
  );
};
