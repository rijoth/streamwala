import React, { useEffect, useState } from 'react';
import { Channel, Group, HistoryEntry } from '../../domain/types.ts';
import { getRecentWatchHistory } from '../../services/storage/db.ts';
import { FocusZone } from '../../shared/focus/index.ts';
import { ScrollViewport, useRowSnapScroller } from '../../shared/scroll/index.ts';
import { Icon } from '../../shared/icons/index.ts';
import { CarouselRow } from './CarouselRow.tsx';
import { CategoryTile } from './ChannelTile.tsx';
import { HeroSection } from './HeroSection.tsx';
import { useLiveNowChannels } from './useLiveNowChannels.ts';

export interface HomeViewProps {
  channels: Channel[];
  groups: Group[];
  onSelectChannel: (channel: Channel) => void;
  onGoToLive: () => void;
  /** Go to Live TV with the given group already selected. */
  onGoToCategory: (groupId: string) => void;
  onGoToGuide: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  channels,
  groups,
  onSelectChannel,
  onGoToLive,
  onGoToCategory,
  onGoToGuide,
}) => {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [heroExpanded, setHeroExpanded] = useState(true);

  const favorites = channels.filter((c) => c.isFavorite);
  const featuredChannel = favorites[0] || channels[0];
  const liveNowChannels = useLiveNowChannels(channels);
  const historyChannels = history
    .map((hist) => channels.find((c) => c.id === hist.channelId))
    .filter((c): c is Channel => Boolean(c));

  useEffect(() => {
    getRecentWatchHistory(10).then(setHistory);
  }, []);

  // Build the vertical row list. `data-scroll-row` indices drive the snap.
  const rows: React.ReactNode[] = [];
  let rowIndex = 0;

  if (featuredChannel) {
    rows.push(
      <HeroSection
        key="hero"
        channel={featuredChannel}
        expanded={heroExpanded}
        onWatch={() => onSelectChannel(featuredChannel)}
        onGuide={onGoToGuide}
      />
    );
    rowIndex += 1;
  }

  if (historyChannels.length > 0) {
    rows.push(
      <CarouselRow
        key="history"
        rowIndex={rowIndex++}
        memoryKey="home:history"
        focusKey="ROW_HISTORY"
        title="Recently Watched"
        icon="history"
        iconClass="text-[var(--md-sys-color-primary)]"
        items={historyChannels}
        onSelect={onSelectChannel}
      />
    );
  }

  if (favorites.length > 0) {
    rows.push(
      <CarouselRow
        key="favorites"
        rowIndex={rowIndex++}
        memoryKey="home:favorites"
        focusKey="ROW_FAVORITES"
        title="Favorites"
        icon="star"
        iconClass="text-amber-400"
        items={favorites}
        onSelect={onSelectChannel}
        action={{ label: 'View All', onClick: onGoToLive }}
      />
    );
  }

  if (liveNowChannels.length > 0) {
    rows.push(
      <CarouselRow
        key="live-now"
        rowIndex={rowIndex++}
        memoryKey="home:live-now"
        focusKey="ROW_LIVE_NOW"
        title="Live now"
        icon="sensors"
        iconClass="text-rose-400"
        items={liveNowChannels}
        onSelect={onSelectChannel}
        action={{ label: 'Open Guide', onClick: onGoToGuide }}
      />
    );
  }

  rows.push(
    <CarouselRow
      key="live"
      rowIndex={rowIndex++}
      memoryKey="home:live"
      focusKey="ROW_LIVE"
      title="Live Streams"
      icon="tv"
      iconClass="text-emerald-400"
      items={channels.slice(0, 15)}
      onSelect={onSelectChannel}
      action={{ label: `Browse (${channels.length})`, onClick: onGoToLive }}
    />
  );

  if (groups.length > 0) {
    rows.push(
      <section key="categories" className="space-y-3 pb-8">
        <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <Icon name="category" size={22} className="text-purple-400" />
          <span>Categories</span>
        </h2>
        <FocusZone focusKey="ROW_CATEGORIES" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {groups.map((group, index) => (
            <CategoryTile
              key={group.id}
              group={group}
              index={index}
              rowIndex={rowIndex + index}
              focusKey={`HOME_CAT_${group.id}`}
              onClick={() => onGoToCategory(group.id)}
            />
          ))}
        </FocusZone>
      </section>
    );
    // Each category tile is its own snap row: tiles in the same grid row share
    // an offsetTop, so moving focus down the grid scrolls row by row instead of
    // pinning the whole (tall) section to the focus line.
    rowIndex += groups.length;
  }

  const { axis } = useRowSnapScroller({
    screenKey: 'home',
    rowCount: rowIndex,
    onFocusedRowChange: (row) => setHeroExpanded(row === 0),
  });

  return (
    <ScrollViewport
      api={axis}
      testId="home-viewport"
      className="flex-1 h-full min-h-0"
      contentClassName="relative p-8 space-y-8"
    >
      {rows}
    </ScrollViewport>
  );
};
