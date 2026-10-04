import React from 'react';
import { Channel, Group } from '../../domain/types.ts';
import { useFocusable } from '../../shared/focus/index.ts';
import { Icon } from '../../shared/icons/index.ts';
import { useNowNext } from '../../app/epgRuntime.tsx';

export const HOME_CARD_SIZE = 208;
export const HOME_CARD_GAP = 16;

export interface ChannelTileProps {
  channel: Channel;
  focusKey: string;
  index: number;
  onSelect: () => void;
}

/** Focusable channel card used inside a Home carousel. */
export const ChannelTile: React.FC<ChannelTileProps> = ({ channel, focusKey, index, onSelect }) => {
  const { ref, focused } = useFocusable({ focusKey, onEnterPress: onSelect });
  const { current, progress } = useNowNext(channel.id);

  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      data-scroll-col={index}
      data-scroll-index={index}
      onClick={onSelect}
      style={{ width: HOME_CARD_SIZE }}
      className={`
        tv-focus-target shrink-0 p-4 rounded-2xl bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)]
        flex flex-col items-center text-center cursor-pointer outline-none
        ${focused ? 'tv-focused ring-3 ring-[var(--md-sys-color-focus-ring)] !bg-[var(--md-sys-color-primary-container)] !border-[var(--md-sys-color-primary)] z-10' : ''}
      `}
    >
      <div className="w-16 h-16 rounded-xl bg-[var(--md-sys-color-surface-container-highest)] p-1 flex items-center justify-center mb-2">
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
      <div className="w-full mt-1">
        <p className="text-[11px] truncate text-[var(--md-sys-color-on-surface-variant)]">
          {current?.title ?? 'No program information'}
        </p>
        <div className="h-1 mt-1 w-full rounded-full bg-[var(--md-sys-color-surface-container-highest)] overflow-hidden">
          <div
            className="h-full bg-[var(--md-sys-color-primary)]"
            style={{ width: `${current ? Math.round(progress * 100) : 0}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export interface CategoryTileProps {
  group: Group;
  focusKey: string;
  index: number;
  /** Vertical snap row index for the page scroller. */
  rowIndex: number;
  onClick: () => void;
}

export const CategoryTile: React.FC<CategoryTileProps> = ({ group, focusKey, index, rowIndex, onClick }) => {
  const { ref, focused } = useFocusable({ focusKey, onEnterPress: onClick });

  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      data-scroll-index={index}
      data-scroll-row={rowIndex}
      onClick={onClick}
      className={`
        tv-focus-target p-4 rounded-2xl bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)]
        cursor-pointer outline-none flex items-center justify-between
        ${focused ? 'tv-focused ring-3 ring-[var(--md-sys-color-focus-ring)] !bg-[var(--md-sys-color-primary-container)]' : ''}
      `}
    >
      <div className="truncate">
        <h4 className="font-bold text-sm truncate">{group.name}</h4>
        <p className="text-xs text-[var(--md-sys-color-outline)]">{group.channelCount} streams</p>
      </div>
      <Icon name="chevron_right" size={20} className="text-[var(--md-sys-color-outline)]" />
    </div>
  );
};
