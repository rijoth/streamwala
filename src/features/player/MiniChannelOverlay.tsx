import React, { useState, useEffect } from 'react';
import { Channel, Group } from '../../domain/types.ts';
import { FocusZone, useFocusable } from '../../shared/focus/index.ts';
import { pushBackHandler } from '../../shared/input/index.ts';
import { Icon } from '../../shared/icons/index.ts';

export interface MiniChannelOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  channels: Channel[];
  groups: Group[];
  activeChannelId: string;
  onSelectChannel: (channel: Channel) => void;
}

export const MiniChannelOverlay: React.FC<MiniChannelOverlayProps> = ({
  isOpen,
  onClose,
  channels,
  groups,
  activeChannelId,
  onSelectChannel,
}) => {
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');

  useEffect(() => {
    if (!isOpen) return;
    return pushBackHandler(() => {
      onClose();
      return true;
    });
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredChannels = selectedGroupId === 'all'
    ? channels
    : channels.filter(c => c.groupId === selectedGroupId);

  return (
    <div className="fixed inset-0 z-50 flex pointer-events-auto animate-fade-in">
      {/* Background click to dismiss */}
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <FocusZone
        isFocusBoundary={true}
        className="w-full max-w-md h-full bg-[var(--md-sys-color-surface-container)] border-r border-[var(--md-sys-color-outline-variant)] shadow-2xl flex flex-col order-first p-6 text-[var(--md-sys-color-on-surface)]"
      >
        <div className="flex items-center justify-between pb-4 border-b border-[var(--md-sys-color-outline-variant)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] flex items-center justify-center">
              <Icon name="list" size={24} />
            </div>
            <div>
              <h2 className="font-bold text-xl tracking-tight">Channels</h2>
              <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">{filteredChannels.length} available</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-outline)] cursor-pointer"
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        {/* Categories selector horizontal scroll */}
        <div className="flex items-center gap-2 py-3 overflow-x-auto whitespace-nowrap scrollbar-none border-b border-[var(--md-sys-color-outline-variant)]">
          <button
            type="button"
            onClick={() => setSelectedGroupId('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer shrink-0 transition-colors ${
              selectedGroupId === 'all'
                ? 'bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)]'
                : 'bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface-variant)]'
            }`}
          >
            All Channels
          </button>
          {groups.map((grp) => (
            <button
              key={grp.id}
              type="button"
              onClick={() => setSelectedGroupId(grp.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer shrink-0 transition-colors ${
                selectedGroupId === grp.id
                  ? 'bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)]'
                  : 'bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface-variant)]'
              }`}
            >
              {grp.name}
            </button>
          ))}
        </div>

        {/* Channels List */}
        <div className="flex-1 overflow-y-auto space-y-1.5 py-3 pr-1">
          {filteredChannels.map((channel) => (
            <MiniChannelItem
              key={channel.id}
              channel={channel}
              isActive={channel.id === activeChannelId}
              onSelect={() => {
                onSelectChannel(channel);
                onClose();
              }}
            />
          ))}
        </div>
      </FocusZone>
    </div>
  );
};

interface MiniChannelItemProps {
  channel: Channel;
  isActive: boolean;
  onSelect: () => void;
}

const MiniChannelItem: React.FC<MiniChannelItemProps> = ({
  channel,
  isActive,
  onSelect,
}) => {
  const { ref, focused } = useFocusable({
    onEnterPress: onSelect,
  });

  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      type="button"
      onClick={onSelect}
      className={`
        tv-focus-target w-full flex items-center gap-3 p-3 rounded-2xl cursor-pointer outline-none text-left
        transition-all duration-100 select-none
        ${
          isActive
            ? 'bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] font-semibold'
            : 'hover:bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface)]'
        }
        ${focused ? 'tv-focused ring-3 ring-[var(--md-sys-color-focus-ring)] scale-102 !bg-[var(--md-sys-color-primary)] !text-[var(--md-sys-color-on-primary)] z-10' : ''}
      `}
    >
      <span className="font-mono text-xs w-8 text-center text-[var(--md-sys-color-outline)] font-bold">
        {typeof channel.number === 'number' && !Number.isNaN(channel.number) ? channel.number : '•'}
      </span>

      {channel.logo ? (
        <img
          src={channel.logo}
          alt={channel.name}
          className="w-9 h-9 object-contain rounded-lg bg-black/20 p-0.5 shrink-0"
          onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
        />
      ) : (
        <div className="w-9 h-9 rounded-lg bg-[var(--md-sys-color-surface-container-highest)] flex items-center justify-center text-xs font-bold shrink-0">
          {channel.name.slice(0, 2).toUpperCase()}
        </div>
      )}

      <div className="flex-1 truncate">
        <div className="text-sm font-semibold truncate">{channel.name}</div>
        <div className="text-xs opacity-70 truncate">{channel.groupName}</div>
      </div>

      {channel.isFavorite && (
        <Icon name="star" size={16} filled className="text-amber-400 shrink-0" />
      )}
    </button>
  );
};
