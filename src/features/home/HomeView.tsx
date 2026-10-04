import React, { useEffect, useState } from 'react';
import { Channel, Group, HistoryEntry } from '../../domain/types.ts';
import { getRecentWatchHistory } from '../../services/storage/db.ts';
import { FocusZone, useFocusable } from '../../shared/focus/index.ts';
import { Button } from '../../shared/ui/index.ts';
import { Icon } from '../../shared/icons/index.ts';

export interface HomeViewProps {
  channels: Channel[];
  groups: Group[];
  onSelectChannel: (channel: Channel) => void;
  onGoToLive: () => void;
  onGoToGuide: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  channels,
  groups,
  onSelectChannel,
  onGoToLive,
  onGoToGuide,
}) => {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const favorites = channels.filter(c => c.isFavorite);
  const featuredChannel = favorites[0] || channels[0];

  useEffect(() => {
    getRecentWatchHistory(10).then(setHistory);
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto p-8 text-[var(--md-sys-color-on-surface)] space-y-8">
      {/* Hero Showcase Banner */}
      {featuredChannel && (
        <div className="relative rounded-3xl overflow-hidden p-8 min-h-[260px] flex flex-col justify-end bg-gradient-to-r from-blue-950/80 via-slate-900/60 to-black/80 border border-white/10 shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-full opacity-20 pointer-events-none flex items-center justify-center">
            {featuredChannel.logo ? (
              <img src={featuredChannel.logo} alt="" className="w-64 h-64 object-contain filter grayscale" />
            ) : (
              <Icon name="live_tv" size={140} />
            )}
          </div>

          <div className="relative z-10 max-w-xl space-y-3">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-red-600/90 text-white text-[11px] font-bold tracking-wider uppercase animate-pulse">
                Featured Live
              </span>
              <span className="text-xs text-[var(--md-sys-color-primary)] font-semibold">
                {featuredChannel.groupName}
              </span>
            </div>

            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              {featuredChannel.name}
            </h1>

            <p className="text-sm text-[var(--md-sys-color-on-surface-variant)] leading-relaxed">
              Experience seamless, instant 10-foot live streaming with hardware acceleration and automatic stream recovery.
            </p>

            <FocusZone focusKey="HERO_ACTIONS" className="flex items-center gap-3 pt-2">
              <Button
                variant="filled"
                icon="play_arrow"
                autoFocus
                onClick={() => onSelectChannel(featuredChannel)}
                className="!px-8 !py-3.5 shadow-xl"
              >
                Watch Now
              </Button>
              <Button
                variant="tonal"
                icon="calendar_month"
                onClick={onGoToGuide}
                className="!px-6 !py-3.5"
              >
                EPG Guide
              </Button>
            </FocusZone>
          </div>
        </div>
      )}

      {/* Continue Watching / Recents Row */}
      {history.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <Icon name="history" size={22} className="text-[var(--md-sys-color-primary)]" />
              <span>Recently Watched</span>
            </h2>
          </div>

          <FocusZone
            focusKey="ROW_HISTORY"
            className="flex items-center gap-4 overflow-x-auto whitespace-nowrap py-3 px-1 scroll-p-4 scrollbar-none"
          >
            {history.map((hist) => {
              const ch = channels.find(c => c.id === hist.channelId);
              if (!ch) return null;

              return (
                <ChannelCard
                  key={hist.id}
                  channel={ch}
                  onSelect={() => onSelectChannel(ch)}
                />
              );
            })}
          </FocusZone>
        </section>
      )}

      {/* Favorite Channels Carousel */}
      {favorites.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <Icon name="star" size={22} filled className="text-amber-400" />
              <span>Favorites</span>
            </h2>
            <button
              type="button"
              onClick={onGoToLive}
              className="text-xs text-[var(--md-sys-color-primary)] hover:underline font-semibold"
            >
              View All
            </button>
          </div>

          <FocusZone
            focusKey="ROW_FAVORITES"
            className="flex items-center gap-4 overflow-x-auto whitespace-nowrap py-3 px-1 scroll-p-4 scrollbar-none"
          >
            {favorites.map((channel) => (
              <ChannelCard
                key={channel.id}
                channel={channel}
                onSelect={() => onSelectChannel(channel)}
              />
            ))}
          </FocusZone>
        </section>
      )}

      {/* Live Now (All channels carousel) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Icon name="tv" size={22} className="text-emerald-400" />
            <span>Live Streams</span>
          </h2>
          <button
            type="button"
            onClick={onGoToLive}
            className="text-xs text-[var(--md-sys-color-primary)] hover:underline font-semibold"
          >
            Browse ({channels.length})
          </button>
        </div>

        <FocusZone
          focusKey="ROW_LIVE"
          className="flex items-center gap-4 overflow-x-auto whitespace-nowrap py-3 px-1 scroll-p-4 scrollbar-none"
        >
          {channels.slice(0, 15).map((channel) => (
            <ChannelCard
              key={channel.id}
              channel={channel}
              onSelect={() => onSelectChannel(channel)}
            />
          ))}
        </FocusZone>
      </section>

      {/* Categories Row */}
      {groups.length > 0 && (
        <section className="space-y-3 pb-8">
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Icon name="category" size={22} className="text-purple-400" />
            <span>Categories</span>
          </h2>

          <FocusZone
            focusKey="ROW_CATEGORIES"
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"
          >
            {groups.map((group) => (
              <CategoryCard
                key={group.id}
                group={group}
                onClick={onGoToLive}
              />
            ))}
          </FocusZone>
        </section>
      )}
    </div>
  );
};

interface ChannelCardProps {
  channel: Channel;
  onSelect: () => void;
}

const ChannelCard: React.FC<ChannelCardProps> = ({ channel, onSelect }) => {
  const { ref, focused } = useFocusable({
    onEnterPress: onSelect,
  });

  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      onClick={onSelect}
      className={`
        tv-focus-target shrink-0 w-52 p-4 rounded-2xl bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)]
        flex flex-col items-center text-center cursor-pointer outline-none transition-all duration-150 hover:bg-[var(--md-sys-color-surface-container-high)]
        scroll-m-6
        ${focused ? 'tv-focused ring-3 ring-[var(--md-sys-color-focus-ring)] scale-103 !bg-[var(--md-sys-color-primary-container)] !border-[var(--md-sys-color-primary)] z-10' : ''}
      `}
    >
      <div className="w-16 h-16 rounded-xl bg-black/20 p-1 flex items-center justify-center mb-2">
        {channel.logo ? (
          <img
            src={channel.logo}
            alt={channel.name}
            className="w-full h-full object-contain"
            onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
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

interface CategoryCardProps {
  group: Group;
  onClick: () => void;
}

const CategoryCard: React.FC<CategoryCardProps> = ({ group, onClick }) => {
  const { ref, focused } = useFocusable({
    onEnterPress: onClick,
  });

  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      onClick={onClick}
      className={`
        tv-focus-target p-4 rounded-2xl bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)]
        cursor-pointer outline-none transition-all duration-150 flex items-center justify-between
        ${focused ? 'tv-focused ring-3 ring-[var(--md-sys-color-focus-ring)] scale-104 !bg-[var(--md-sys-color-primary-container)]' : ''}
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
