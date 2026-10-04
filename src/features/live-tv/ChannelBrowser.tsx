import React, { useState } from 'react';
import { Channel, Group } from '../../domain/types.ts';
import { FocusZone, useFocusable } from '../../shared/focus/index.ts';
import { Card, Chip } from '../../shared/ui/index.ts';
import { Icon } from '../../shared/icons/index.ts';

export interface ChannelBrowserProps {
  channels: Channel[];
  groups: Group[];
  activeGroupId: string;
  onSelectGroup: (groupId: string) => void;
  onSelectChannel: (channel: Channel) => void;
  onToggleFavorite: (channelId: string) => void;
}

export const ChannelBrowser: React.FC<ChannelBrowserProps> = ({
  channels,
  groups,
  activeGroupId,
  onSelectGroup,
  onSelectChannel,
  onToggleFavorite,
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const filteredChannels = activeGroupId === 'all'
    ? channels
    : activeGroupId === 'favorites'
    ? channels.filter(c => c.isFavorite)
    : channels.filter(c => c.groupId === activeGroupId);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden text-[var(--md-sys-color-on-surface)]">
      {/* Top Categories Row */}
      <div className="py-4 border-b border-[var(--md-sys-color-outline-variant)]">
        <FocusZone
          focusKey="CHANNEL_CATEGORIES"
          className="flex items-center gap-3 overflow-x-auto whitespace-nowrap scrollbar-none px-6"
        >
          <Chip
            label="All Channels"
            selected={activeGroupId === 'all'}
            onClick={() => onSelectGroup('all')}
            badge={channels.length}
            icon="tv"
          />
          <Chip
            label="Favorites"
            selected={activeGroupId === 'favorites'}
            onClick={() => onSelectGroup('favorites')}
            badge={channels.filter(c => c.isFavorite).length}
            icon="star"
          />
          {groups.map((group) => (
            <Chip
              key={group.id}
              label={group.name}
              selected={activeGroupId === group.id}
              onClick={() => onSelectGroup(group.id)}
              badge={group.channelCount}
            />
          ))}
        </FocusZone>
      </div>

      {/* Main Channels Content Area */}
      {/* Main Channels Content Area */}
      <div className="flex-1 overflow-y-auto p-6 scroll-p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight">
              {activeGroupId === 'all' ? 'All Channels' : activeGroupId === 'favorites' ? 'Favorite Channels' : groups.find(g => g.id === activeGroupId)?.name || 'Channels'}
            </h2>
            <span className="text-sm text-[var(--md-sys-color-outline)]">
              ({filteredChannels.length})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              className="px-3 py-1.5 rounded-xl bg-[var(--md-sys-color-surface-container)] hover:bg-[var(--md-sys-color-surface-container-high)] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Icon name={viewMode === 'grid' ? 'view_list' : 'grid_view'} size={18} />
              <span>{viewMode === 'grid' ? 'List View' : 'Grid View'}</span>
            </button>
          </div>
        </div>

        {filteredChannels.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[var(--md-sys-color-surface-container)] flex items-center justify-center text-[var(--md-sys-color-outline)] mb-3">
              <Icon name="tv_off" size={32} />
            </div>
            <h3 className="font-semibold text-lg">No channels found in this category</h3>
            <p className="text-sm text-[var(--md-sys-color-outline)] mt-1">Select another group above or add favorites.</p>
          </div>
        ) : viewMode === 'grid' ? (
          <FocusZone
            focusKey="CHANNEL_GRID"
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 pb-6"
          >
            {filteredChannels.map((channel, idx) => (
              <ChannelGridCard
                key={channel.id}
                channel={channel}
                autoFocus={idx === 0}
                onSelect={() => onSelectChannel(channel)}
                onToggleFavorite={() => onToggleFavorite(channel.id)}
              />
            ))}
          </FocusZone>
        ) : (
          <FocusZone
            focusKey="CHANNEL_LIST"
            className="flex flex-col gap-2 pb-6"
          >
            {filteredChannels.map((channel, idx) => (
              <ChannelListItem
                key={channel.id}
                channel={channel}
                autoFocus={idx === 0}
                onSelect={() => onSelectChannel(channel)}
                onToggleFavorite={() => onToggleFavorite(channel.id)}
              />
            ))}
          </FocusZone>
        )}
      </div>
    </div>
  );
};

interface ChannelItemProps {
  channel: Channel;
  autoFocus?: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
}

const ChannelGridCard: React.FC<ChannelItemProps> = ({
  channel,
  autoFocus,
  onSelect,
  onToggleFavorite,
}) => {
  const { ref, focused } = useFocusable({
    autoFocus,
    onEnterPress: onSelect,
  });

  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      onClick={onSelect}
      className={`
        tv-focus-target group relative rounded-2xl p-4 flex flex-col items-center text-center cursor-pointer outline-none
        bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)]
        transition-all duration-150 hover:bg-[var(--md-sys-color-surface-container-high)]
        scroll-m-6
        ${focused ? 'tv-focused ring-3 ring-[var(--md-sys-color-focus-ring)] scale-103 !bg-[var(--md-sys-color-primary-container)] !border-[var(--md-sys-color-primary)] z-10' : ''}
      `}
    >
      {/* Top badges */}
      <div className="w-full flex items-center justify-between mb-3 text-xs">
        <span className="font-mono font-bold text-[var(--md-sys-color-primary)] bg-black/40 px-2 py-0.5 rounded-lg">
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

      {/* Channel Logo */}
      <div className="w-20 h-20 mb-3 flex items-center justify-center p-2 rounded-2xl bg-black/20">
        {channel.logo ? (
          <img
            src={channel.logo}
            alt={channel.name}
            className="w-full h-full object-contain"
            onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full rounded-xl bg-[var(--md-sys-color-surface-container-highest)] flex items-center justify-center font-bold text-xl text-[var(--md-sys-color-primary)]">
            {channel.name.slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>

      <h4 className="font-bold text-base truncate w-full text-[var(--md-sys-color-on-surface)] group-hover:text-[var(--md-sys-color-primary)]">
        {channel.name}
      </h4>
      <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] truncate w-full mt-0.5">
        {channel.groupName}
      </p>
    </div>
  );
};

const ChannelListItem: React.FC<ChannelItemProps> = ({
  channel,
  autoFocus,
  onSelect,
  onToggleFavorite,
}) => {
  const { ref, focused } = useFocusable({
    autoFocus,
    onEnterPress: onSelect,
  });

  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      onClick={onSelect}
      className={`
        tv-focus-target group flex items-center gap-4 p-3.5 rounded-2xl cursor-pointer outline-none
        bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)]
        transition-all duration-150 hover:bg-[var(--md-sys-color-surface-container-high)]
        scroll-m-4
        ${focused ? 'tv-focused ring-3 ring-[var(--md-sys-color-focus-ring)] scale-102 !bg-[var(--md-sys-color-primary-container)] z-10' : ''}
      `}
    >
      <span className="font-mono font-bold text-base w-10 text-center text-[var(--md-sys-color-primary)]">
        {typeof channel.number === 'number' && !Number.isNaN(channel.number) ? channel.number : '•'}
      </span>

      <div className="w-12 h-12 rounded-xl bg-black/20 p-1 flex items-center justify-center shrink-0">
        {channel.logo ? (
          <img
            src={channel.logo}
            alt={channel.name}
            className="w-full h-full object-contain"
            onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
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
