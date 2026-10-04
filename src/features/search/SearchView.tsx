import React, { useMemo, useState } from 'react';
import { Channel } from '../../domain/types.ts';
import { FocusZone, useFocusable } from '../../shared/focus/index.ts';
import { TextField } from '../../shared/ui/index.ts';
import { Icon } from '../../shared/icons/index.ts';
import {
  ScrollPositionIndicator,
  VirtualGrid,
  useGridScroller,
} from '../../shared/scroll/index.ts';

export interface SearchViewProps {
  channels: Channel[];
  onSelectChannel: (channel: Channel) => void;
  onToggleFavorite: (channelId: string) => void;
}

const SEARCH_ITEM_HEIGHT = 168;
const SEARCH_GAP = 16;

export const SearchView: React.FC<SearchViewProps> = ({
  channels,
  onSelectChannel,
  onToggleFavorite,
}) => {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();
    return channels.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.groupName && c.groupName.toLowerCase().includes(q)) ||
        (c.number !== undefined && String(c.number).includes(q))
    );
  }, [channels, query]);

  const { axis, columns } = useGridScroller({
    screenKey: 'search',
    count: filtered.length,
    rowSize: SEARCH_ITEM_HEIGHT + SEARCH_GAP,
    minItemWidth: 180,
    gap: SEARCH_GAP,
    maxColumns: 5,
  });
  const totalRows = Math.max(1, Math.ceil(filtered.length / Math.max(1, columns)));

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden p-6 text-[var(--md-sys-color-on-surface)]">
      <div className="max-w-2xl w-full mb-6">
        <h2 className="text-2xl font-bold tracking-tight mb-3">Global Channel Search</h2>
        <TextField
          label="Search by name, number, or category"
          value={query}
          onChange={setQuery}
          placeholder="Type to search with remote keyboard..."
          icon="search"
          focusKey="SEARCH_FIELD"
          autoFocus
        />
      </div>

      <div className="flex items-center gap-3 mb-3 min-h-[20px] text-sm text-[var(--md-sys-color-outline)] px-1">
        {query && (
          <span>Found {filtered.length} matching channels</span>
        )}
        <ScrollPositionIndicator axis={axis} itemSize={SEARCH_ITEM_HEIGHT + SEARCH_GAP} count={totalRows} />
      </div>

      <div className="flex-1 min-h-0">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center text-[var(--md-sys-color-outline)]">
            <Icon name="search" size={48} className="mb-2 opacity-40" />
            <p className="text-base font-semibold">
              {query ? 'No matching channels found' : 'Enter a channel name or category above'}
            </p>
          </div>
        ) : (
          <FocusZone focusKey="SEARCH_RESULTS" className="h-full">
            <div ref={axis.viewportRef} data-scroll-axis="vertical" className="relative h-full overflow-hidden">
              <VirtualGrid<Channel>
                axis={axis}
                items={filtered}
                columns={columns}
                itemHeight={SEARCH_ITEM_HEIGHT}
                gap={SEARCH_GAP}
                className="px-[var(--focus-ring-pad)]"
                getKey={(channel) => channel.id}
                renderItem={(channel) => (
                  <SearchChannelCard
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

interface SearchChannelCardProps {
  channel: Channel;
  onSelect: () => void;
  onToggleFavorite: () => void;
}

const SearchChannelCard: React.FC<SearchChannelCardProps> = ({ channel, onSelect, onToggleFavorite }) => {
  const { ref, focused } = useFocusable({
    focusKey: `SEARCH_RESULT_${channel.id}`,
    onEnterPress: onSelect,
  });

  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      onClick={onSelect}
      style={{ height: SEARCH_ITEM_HEIGHT }}
      className={`
        tv-focus-target group relative rounded-2xl p-4 flex flex-col items-center text-center cursor-pointer outline-none overflow-hidden
        bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)]
        ${focused ? 'tv-focused ring-3 ring-[var(--md-sys-color-focus-ring)] !bg-[var(--md-sys-color-primary-container)] !border-[var(--md-sys-color-primary)] z-10' : ''}
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
          className="p-1 text-[var(--md-sys-color-outline)] hover:text-amber-400 cursor-pointer"
        >
          <Icon name="star" size={16} filled={channel.isFavorite} className={channel.isFavorite ? 'text-amber-400' : ''} />
        </button>
      </div>

      <div className="w-16 h-16 rounded-xl bg-[var(--md-sys-color-surface-container-highest)] p-1 flex items-center justify-center mb-2 shrink-0">
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
