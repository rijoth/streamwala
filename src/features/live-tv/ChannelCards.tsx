import React from 'react';
import { Channel } from '../../domain/types.ts';
import { useFocusable } from '../../shared/focus/index.ts';
import { Icon } from '../../shared/icons/index.ts';

export const CHANNEL_GRID_ITEM_HEIGHT = 208;
export const CHANNEL_LIST_ITEM_HEIGHT = 64;
export const CHANNEL_GAP = 16;

interface ChannelItemProps {
  channel: Channel;
  index: number;
  focusKey: string;
  onSelect: () => void;
  onToggleFavorite: () => void;
}

/** Fixed-height grid card. Height is fixed so index math stays exact. */
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
      onClick={onSelect}
      style={{ height: CHANNEL_GRID_ITEM_HEIGHT }}
      className={`
        tv-focus-target group relative rounded-2xl p-4 flex flex-col items-center text-center cursor-pointer outline-none overflow-hidden
        bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)]
        ${focused ? 'tv-focused ring-3 ring-[var(--md-sys-color-focus-ring)] !bg-[var(--md-sys-color-primary-container)] !border-[var(--md-sys-color-primary)] z-10' : ''}
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
          className="p-1 text-[var(--md-sys-color-outline)] hover:text-amber-400 cursor-pointer"
        >
          <Icon name="star" size={18} filled={channel.isFavorite} className={channel.isFavorite ? 'text-amber-400' : ''} />
        </button>
      </div>

      <div className="w-20 h-20 mb-3 flex items-center justify-center p-2 rounded-2xl bg-[var(--md-sys-color-surface-container-highest)] shrink-0">
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

/** Fixed-height list row. */
export const ChannelListItem: React.FC<ChannelItemProps> = ({
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
      onClick={onSelect}
      style={{ height: CHANNEL_LIST_ITEM_HEIGHT }}
      className={`
        tv-focus-target group flex items-center gap-4 p-3 rounded-2xl cursor-pointer outline-none overflow-hidden
        bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)]
        ${focused ? 'tv-focused ring-3 ring-[var(--md-sys-color-focus-ring)] !bg-[var(--md-sys-color-primary-container)] z-10' : ''}
      `}
    >
      <span className="font-mono font-bold text-base w-10 text-center text-[var(--md-sys-color-primary)]">
        {typeof channel.number === 'number' && !Number.isNaN(channel.number) ? channel.number : '•'}
      </span>

      <div className="w-11 h-11 rounded-xl bg-[var(--md-sys-color-surface-container-highest)] p-1 flex items-center justify-center shrink-0">
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
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite();
        }}
        className="p-2 text-[var(--md-sys-color-outline)] hover:text-amber-400 cursor-pointer"
      >
        <Icon name="star" size={20} filled={channel.isFavorite} className={channel.isFavorite ? 'text-amber-400' : ''} />
      </button>
    </div>
  );
};
