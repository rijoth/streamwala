import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Channel, Group } from '../../domain/types.ts';
import { FocusZone, getCurrentFocusKey, setFocus } from '../../shared/focus/index.ts';
import { useTvInput } from '../../shared/input/index.ts';
import { Chip } from '../../shared/ui/index.ts';
import { Icon } from '../../shared/icons/index.ts';
import {
  ScrollPositionIndicator,
  VirtualGrid,
  clamp,
  rowSnapOffset,
  useGridScroller,
  useKeyRepeat,
  useStripScroller,
} from '../../shared/scroll/index.ts';
import {
  CHANNEL_GAP,
  CHANNEL_GRID_ITEM_HEIGHT,
  CHANNEL_LIST_ITEM_HEIGHT,
  ChannelGridCard,
  ChannelListItem,
} from './ChannelCards.tsx';

export interface ChannelBrowserProps {
  channels: Channel[];
  groups: Group[];
  activeGroupId: string;
  onSelectGroup: (groupId: string) => void;
  onSelectChannel: (channel: Channel) => void;
  onToggleFavorite: (channelId: string) => void;
}

type ChannelRef = { id: string };

export const ChannelBrowser: React.FC<ChannelBrowserProps> = ({
  channels,
  groups,
  activeGroupId,
  onSelectGroup,
  onSelectChannel,
  onToggleFavorite,
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const isList = viewMode === 'list';

  const filteredChannels = useMemo(
    () =>
      activeGroupId === 'all'
        ? channels
        : activeGroupId === 'favorites'
          ? channels.filter((c) => c.isFavorite)
          : channels.filter((c) => c.groupId === activeGroupId),
    [channels, activeGroupId]
  );

  const itemHeight = isList ? CHANNEL_LIST_ITEM_HEIGHT : CHANNEL_GRID_ITEM_HEIGHT;
  const rowSize = itemHeight + (isList ? 8 : CHANNEL_GAP);

  const { axis, config, columns } = useGridScroller({
    screenKey: `live:${activeGroupId}:${viewMode}`,
    count: filteredChannels.length,
    rowSize,
    minItemWidth: 180,
    gap: CHANNEL_GAP,
    maxColumns: 6,
    columns: isList ? 1 : undefined,
  });

  const chips = useMemo(() => {
    const base = [
      { id: 'all', label: 'All Channels', badge: channels.length, icon: 'tv' as const },
      { id: 'favorites', label: 'Favorites', badge: channels.filter((c) => c.isFavorite).length, icon: 'star' as const },
    ];
    return [...base, ...groups.map((g) => ({ id: g.id, label: g.name, badge: g.channelCount, icon: undefined }))];
  }, [channels, groups]);

  const strip = useStripScroller({ itemCount: chips.length, memoryKey: `live:groups:${activeGroupId}` });

  const totalRows = Math.max(1, Math.ceil(filteredChannels.length / Math.max(1, columns)));
  const keyForIndex = (index: number, mode = isList) =>
    `${mode ? 'CHANNEL_LIST' : 'CHANNEL_GRID'}_${filteredChannels[index]?.id ?? ''}`;

  const idIndex = useMemo(() => {
    const map = new Map<string, number>();
    filteredChannels.forEach((c, i) => map.set(c.id, i));
    return map;
  }, [filteredChannels]);

  const currentIndex = (): number => {
    const key = getCurrentFocusKey() ?? '';
    const match = key.match(/^CHANNEL_(?:GRID|LIST)_(.+)$/);
    if (!match) return -1;
    return idIndex.get(match[1]) ?? -1;
  };

  const jumpToIndex = (index: number) => {
    if (index < 0 || index >= filteredChannels.length) return;
    const row = Math.floor(index / Math.max(1, columns));
    const target = rowSnapOffset(row * rowSize, axis.getViewportSize(), axis.getContentSize(), config);
    axis.scrollToOffset(target, { animate: false });
    requestAnimationFrame(() => setFocus(keyForIndex(index)));
  };

  const jumpRows = (deltaRows: number) => {
    const current = currentIndex();
    if (current < 0) return;
    jumpToIndex(clamp(current + deltaRows * columns, 0, Math.max(0, filteredChannels.length - 1)));
  };

  // Held D-pad accelerates to 2/4 rows per step via the shared input layer.
  useKeyRepeat((action, step) => {
    if (action === 'NAV_DOWN') jumpRows(step);
    else if (action === 'NAV_UP') jumpRows(-step);
  });

  // CH+/CH- and PageUp/PageDown jump one viewport of rows; digits quick-jump by
  // channel number (2s commit window).
  const digitBufferRef = useRef('');
  const digitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (digitTimerRef.current) clearTimeout(digitTimerRef.current);
  }, []);

  useTvInput((event) => {
    if (event.action === 'CH_DOWN' || event.action === 'CH_UP') {
      const viewportRows = Math.max(1, Math.floor(axis.getViewportSize() / rowSize));
      jumpRows(event.action === 'CH_DOWN' ? viewportRows : -viewportRows);
      return true;
    }
    if (event.action === 'DIGIT' && event.digit !== undefined) {
      digitBufferRef.current += String(event.digit);
      if (digitTimerRef.current) clearTimeout(digitTimerRef.current);
      digitTimerRef.current = setTimeout(() => {
        const buffer = digitBufferRef.current;
        digitBufferRef.current = '';
        if (!buffer) return;
        const index = filteredChannels.findIndex((c) => String(c.number ?? '').startsWith(buffer));
        if (index >= 0) jumpToIndex(index);
      }, 2000);
      return true;
    }
    return false;
  }, [filteredChannels, columns, rowSize, activeGroupId, viewMode]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden text-[var(--md-sys-color-on-surface)]">
      <div className="py-4 border-b border-[var(--md-sys-color-outline-variant)]">
        <div ref={strip.axis.viewportRef} data-scroll-axis="horizontal" className="relative overflow-hidden">
          <FocusZone focusKey="CHANNEL_CATEGORIES">
            <div
              ref={strip.axis.contentRef}
              className="relative flex items-center gap-3 px-[var(--focus-ring-pad)] py-1"
            >
              {chips.map((chip, index) => (
                <div key={chip.id} data-scroll-item={index} className="shrink-0">
                  <Chip
                    label={chip.label}
                    icon={chip.icon}
                    badge={chip.badge}
                    selected={activeGroupId === chip.id}
                    onClick={() => onSelectGroup(chip.id)}
                  />
                </div>
              ))}
            </div>
          </FocusZone>
        </div>
      </div>

      <div className="flex items-center justify-between py-3 px-6">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold tracking-tight">
            {activeGroupId === 'all'
              ? 'All Channels'
              : activeGroupId === 'favorites'
                ? 'Favorite Channels'
                : groups.find((g) => g.id === activeGroupId)?.name || 'Channels'}
          </h2>
          <span className="text-sm text-[var(--md-sys-color-outline)]">({filteredChannels.length})</span>
          <ScrollPositionIndicator axis={axis} itemSize={rowSize} count={totalRows} />
        </div>

        <button
          type="button"
          onClick={() => setViewMode(isList ? 'grid' : 'list')}
          className="px-3 py-1.5 rounded-xl bg-[var(--md-sys-color-surface-container)] hover:bg-[var(--md-sys-color-surface-container-high)] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
        >
          <Icon name={isList ? 'grid_view' : 'view_list'} size={18} />
          <span>{isList ? 'Grid View' : 'List View'}</span>
        </button>
      </div>

      <div className="flex-1 min-h-0 px-6 pb-6">
        {filteredChannels.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[var(--md-sys-color-surface-container)] flex items-center justify-center text-[var(--md-sys-color-outline)] mb-3">
              <Icon name="tv_off" size={32} />
            </div>
            <h3 className="font-semibold text-lg">No channels found in this category</h3>
            <p className="text-sm text-[var(--md-sys-color-outline)] mt-1">
              Select another group above or add favorites.
            </p>
          </div>
        ) : (
          <FocusZone focusKey={isList ? 'CHANNEL_LIST' : 'CHANNEL_GRID'} className="h-full">
            <div
              ref={axis.viewportRef}
              data-testid="live-viewport"
              data-scroll-axis="vertical"
              className="relative h-full overflow-hidden"
            >
              <VirtualGrid<ChannelRef>
                axis={axis}
                items={filteredChannels}
                columns={columns}
                itemHeight={itemHeight}
                gap={isList ? 8 : CHANNEL_GAP}
                className="px-[var(--focus-ring-pad)]"
                getKey={(item) => item.id}
                renderItem={(channel, index) => {
                  const ch = channel as Channel;
                  return isList ? (
                    <ChannelListItem
                      channel={ch}
                      index={index}
                      focusKey={keyForIndex(index)}
                      onSelect={() => onSelectChannel(ch)}
                      onToggleFavorite={() => onToggleFavorite(ch.id)}
                    />
                  ) : (
                    <ChannelGridCard
                      channel={ch}
                      index={index}
                      focusKey={keyForIndex(index)}
                      onSelect={() => onSelectChannel(ch)}
                      onToggleFavorite={() => onToggleFavorite(ch.id)}
                    />
                  );
                }}
              />
            </div>
          </FocusZone>
        )}
      </div>
    </div>
  );
};
