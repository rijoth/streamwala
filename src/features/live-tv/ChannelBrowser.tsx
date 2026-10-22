import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Channel, Group } from '../../domain/types.ts';
import { FocusZone, focusKeyExists, getCurrentFocusKey, setFocus } from '../../shared/focus/index.ts';
import { useChannelSearch } from '../../shared/hooks/useChannelSearch.ts';
import { useTvInput } from '../../shared/input/index.ts';
import { Icon } from '../../shared/icons/index.ts';
import { useDesignPx } from '../../shared/utils/designPx.ts';
import {
  ScrollPositionIndicator,
  VirtualGrid,
  clamp,
  useFocusRingClipStyle,
  rowSnapOffset,
  useFocusedItemIndex,
  useGridScroller,
  useKeyRepeat,
} from '../../shared/scroll/index.ts';
import { SearchField, useSearchFocusGuard } from '../search/index.ts';
import { CategoryRail, type CategoryOption } from './CategoryRail.tsx';
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

/** Both card types are results when the view toggle changes. */
const RESULT_FOCUS_PREFIXES = ['CHANNEL_GRID_', 'CHANNEL_LIST_'] as const;

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

  // The active category is the search scope: `all`, `favorites`, or a group.
  const scopedChannels = useMemo(
    () =>
      activeGroupId === 'all'
        ? channels
        : activeGroupId === 'favorites'
          ? channels.filter((c) => c.isFavorite)
          : channels.filter((c) => c.groupId === activeGroupId),
    [channels, activeGroupId]
  );

  const { query, setQuery, isSearching, results } = useChannelSearch(scopedChannels);
  const displayChannels = isSearching ? results : scopedChannels;

  const designPx = useDesignPx();
  const clipStyle = useFocusRingClipStyle();
  const listGap = 8 * designPx;
  const gap = isList ? listGap : CHANNEL_GAP * designPx;
  const fallbackItemHeight = (isList ? CHANNEL_LIST_ITEM_HEIGHT : CHANNEL_GRID_ITEM_HEIGHT) * designPx;

  const { axis, config, columns, itemHeight, rowSize } = useGridScroller({
    // Query is deliberately absent: the scroller is keyed by screen, so typing
    // never re-runs the remembered offset/focus restore.
    screenKey: `live:${activeGroupId}:${viewMode}`,
    count: displayChannels.length,
    rowSize: fallbackItemHeight + gap,
    minItemWidth: 180 * designPx,
    gap,
    maxColumns: 6,
    columns: isList ? 1 : undefined,
    // Cards are rem-sized, so the row pitch must come from the rendered cell.
    measureItemHeight: true,
  });

  useSearchFocusGuard({
    items: displayChannels,
    isSearching,
    fieldFocusKey: 'LIVE_SEARCH_FIELD',
    resultFocusPrefixes: RESULT_FOCUS_PREFIXES,
    axis,
    columns,
    rowSize,
    config,
  });

  const chips = useMemo<CategoryOption[]>(() => {
    const base: CategoryOption[] = [
      { id: 'all', label: 'All Channels', badge: channels.length, icon: 'tv' },
      { id: 'favorites', label: 'Favorites', badge: channels.filter((c) => c.isFavorite).length, icon: 'star' },
    ];
    return [...base, ...groups.map((g): CategoryOption => ({ id: g.id, label: g.name, badge: g.channelCount }))];
  }, [channels, groups]);

  const railIdIndex = useMemo(() => {
    const map = new Map<string, number>();
    chips.forEach((chip, index) => map.set(chip.id, index));
    return map;
  }, [chips]);

  const currentRailIndex = (): number => {
    const key = getCurrentFocusKey() ?? '';
    if (!key.startsWith('CATEGORY_')) return -1;
    return railIdIndex.get(key.slice('CATEGORY_'.length)) ?? -1;
  };

  const totalRows = Math.max(1, Math.ceil(displayChannels.length / Math.max(1, columns)));
  const keyForIndex = (index: number, mode = isList) =>
    `${mode ? 'CHANNEL_LIST' : 'CHANNEL_GRID'}_${displayChannels[index]?.id ?? ''}`;

  const idIndex = useMemo(() => {
    const map = new Map<string, number>();
    displayChannels.forEach((c, i) => map.set(c.id, i));
    return map;
  }, [displayChannels]);

  const currentIndex = (): number => {
    const key = getCurrentFocusKey() ?? '';
    const match = key.match(/^CHANNEL_(?:GRID|LIST)_(.+)$/);
    if (!match) return -1;
    return idIndex.get(match[1]) ?? -1;
  };

  const jumpToIndex = (index: number) => {
    if (index < 0 || index >= displayChannels.length) return;
    const key = keyForIndex(index);
    // Fast path: the target is already inside the rendered window (within
    // overscan), so focus it directly and let minimal-scroll keep it in view.
    if (focusKeyExists(key)) {
      setFocus(key);
      return;
    }
    const row = Math.floor(index / Math.max(1, columns));
    const target = rowSnapOffset(row * rowSize, axis.getViewportSize(), axis.getContentSize(), config);
    axis.scrollToOffset(target, { animate: false });
    requestAnimationFrame(() => setFocus(key));
  };

  const jumpRows = (deltaRows: number) => {
    const current = currentIndex();
    if (current < 0) return;
    jumpToIndex(clamp(current + deltaRows * columns, 0, Math.max(0, displayChannels.length - 1)));
  };

  // Remember the last channel card the viewer stood on, so RIGHT from the
  // category rail returns there instead of guessing spatially. The channel id
  // survives a scope change; a stale flat index would point at another card.
  const lastGridChannelIdRef = useRef<string | null>(null);
  const displayChannelsRef = useRef(displayChannels);
  displayChannelsRef.current = displayChannels;
  useFocusedItemIndex(
    axis.viewportRef,
    useCallback((info) => {
      lastGridChannelIdRef.current = displayChannelsRef.current[info.index]?.id ?? null;
    }, [])
  );

  const enterContent = () => {
    if (displayChannels.length === 0) return;
    const rememberedId = lastGridChannelIdRef.current;
    const remembered = rememberedId
      ? displayChannels.findIndex((channel) => channel.id === rememberedId)
      : -1;
    const fallbackRow = Math.floor(axis.getOffset() / Math.max(1, rowSize));
    const fallbackIndex = fallbackRow * Math.max(1, columns);
    const index =
      remembered >= 0 ? remembered : Math.min(displayChannels.length - 1, fallbackIndex);
    jumpToIndex(index);
  };

  // Held D-pad accelerates to 2/4 rows per step via the shared input layer.
  // While the rail owns focus, the same steps move through categories.
  useKeyRepeat((action, step) => {
    if (action !== 'NAV_DOWN' && action !== 'NAV_UP') return;
    const railIndex = currentRailIndex();
    if (railIndex >= 0) {
      const next = clamp(
        railIndex + (action === 'NAV_DOWN' ? step : -step),
        0,
        Math.max(0, chips.length - 1)
      );
      const target = chips[next];
      if (target) setFocus(`CATEGORY_${target.id}`);
      return;
    }
    jumpRows(action === 'NAV_DOWN' ? step : -step);
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
        const index = displayChannels.findIndex((c) => String(c.number ?? '').startsWith(buffer));
        if (index >= 0) jumpToIndex(index);
      }, 2000);
      return true;
    }
    return false;
  }, [displayChannels, columns, rowSize, activeGroupId, viewMode]);

  return (
    <div className="flex-1 flex h-full min-h-0 overflow-hidden text-[var(--md-sys-color-on-surface)]">
      <CategoryRail
        items={chips}
        activeId={activeGroupId}
        onSelect={onSelectGroup}
        onEnterContent={enterContent}
      />

      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
        <div className="px-6 pt-4">
          <SearchField
            focusKey="LIVE_SEARCH_FIELD"
            value={query}
            onChange={setQuery}
            label="Search channels"
            placeholder="Search this category by name, number or category"
          />
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
            <span className="text-sm text-[var(--md-sys-color-outline)]">
              {isSearching ? `${displayChannels.length} of ${scopedChannels.length}` : `(${scopedChannels.length})`}
            </span>
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
          {/* The grid stays mounted at zero items so `contentRef` never detaches
              from the layout pass; empty states are overlays inside the viewport. */}
          <FocusZone focusKey={isList ? 'CHANNEL_LIST' : 'CHANNEL_GRID'} className="h-full">
            <div
              ref={axis.viewportRef}
              data-testid="live-viewport"
              data-scroll-axis="vertical"
              className="relative h-full overflow-hidden"
              style={clipStyle}
            >
              <VirtualGrid<ChannelRef>
                axis={axis}
                items={displayChannels}
                columns={columns}
                itemHeight={itemHeight}
                gap={gap}
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

              {displayChannels.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                  <div className="w-16 h-16 rounded-2xl bg-[var(--md-sys-color-surface-container)] flex items-center justify-center text-[var(--md-sys-color-outline)] mb-3">
                    <Icon name={isSearching ? 'search_off' : 'tv_off'} size={32} />
                  </div>
                  <h3 className="font-semibold text-lg">
                    {isSearching ? 'No channels match your search' : 'No channels found in this category'}
                  </h3>
                  <p className="text-sm text-[var(--md-sys-color-outline)] mt-1">
                    {isSearching
                      ? `Nothing in this category matches “${query.trim()}”. Clear the search or pick another group.`
                      : 'Select another category on the left or add favorites.'}
                  </p>
                </div>
              )}
            </div>
          </FocusZone>
        </div>
      </div>
    </div>
  );
};
