import React, { useEffect, useState, useCallback } from 'react';
import { initFocusEngine } from './shared/focus/index.ts';
import { useTvInput, useIdleCursor } from './shared/input/index.ts';
import { NavigationRail, NavDestination } from './shared/ui/index.ts';
import { useSettingsStore, applyTheme } from './app/settingsStore.ts';
import { getActivePlaylist, getAllPlaylists, getChannelsByGroup, getGroupsForPlaylist, toggleChannelFavorite } from './services/storage/db.ts';
import { syncDemoPlaylistIfOutdated } from './services/playlist/demoPlaylist.ts';
import { Playlist, Channel, Group } from './domain/types.ts';

import { OnboardingFlow } from './features/onboarding/index.ts';
import { PlayerView } from './features/player/index.ts';
import { HomeView } from './features/home/index.ts';
import { ChannelBrowser } from './features/live-tv/index.ts';
import { EpgGuideView } from './features/guide/index.ts';
import { FavoritesView } from './features/favorites/index.ts';
import { SearchView } from './features/search/index.ts';
import { SettingsView } from './features/settings/index.ts';
import { GalleryView } from './features/gallery/index.ts';

const NAV_DESTINATIONS: NavDestination[] = [
  { id: 'home', label: 'Home', icon: 'home', path: '/' },
  { id: 'live', label: 'Live TV', icon: 'live_tv', path: '/live' },
  { id: 'guide', label: 'EPG Guide', icon: 'calendar_month', path: '/guide' },
  { id: 'favorites', label: 'Favorites', icon: 'star', path: '/favorites' },
  { id: 'search', label: 'Search', icon: 'search', path: '/search' },
  { id: 'settings', label: 'Settings', icon: 'settings', path: '/settings' },
  { id: 'gallery', label: 'Dev Gallery', icon: 'widgets', path: '/dev/gallery' },
];

export default function App() {
  const { settings } = useSettingsStore();

  const [isLoading, setIsLoading] = useState(true);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [activePlaylist, setActivePlaylist] = useState<Playlist | undefined>();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string>('all');

  // Active Navigation destination
  const [activeNavId, setActiveNavId] = useState<string>('home');

  // Currently playing channel
  const [playingChannel, setPlayingChannel] = useState<Channel | null>(null);

  // Forced onboarding state (e.g. adding new source)
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Initialize TV spatial engine and idle cursor
  useEffect(() => {
    initFocusEngine();
    applyTheme(settings);
  }, [settings]);

  useIdleCursor(3500);

  // Load database state
  const refreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      await syncDemoPlaylistIfOutdated();
      const allPl = await getAllPlaylists();
      setPlaylists(allPl);

      const activePl = await getActivePlaylist();
      setActivePlaylist(activePl);

      if (activePl) {
        const [chans, grps] = await Promise.all([
          getChannelsByGroup(activePl.id),
          getGroupsForPlaylist(activePl.id),
        ]);
        setChannels(chans);
        setGroups(grps);
      } else {
        setChannels([]);
        setGroups([]);
      }
    } catch (err) {
      console.error('Error loading IPTV data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Handle color keys shortcuts when not inside video player
  useTvInput((event) => {
    if (playingChannel) return; // Player has its own handlers

    if (event.action === 'COLOR_RED') {
      setActiveNavId('favorites');
      return true;
    }
    if (event.action === 'COLOR_GREEN') {
      setActiveNavId('guide');
      return true;
    }
    if (event.action === 'COLOR_YELLOW') {
      setActiveNavId('search');
      return true;
    }
    if (event.action === 'COLOR_BLUE') {
      setActiveNavId('settings');
      return true;
    }
  }, [playingChannel]);

  const handleToggleFavorite = async (channelId: string) => {
    const isFav = await toggleChannelFavorite(channelId);
    setChannels((prev) =>
      prev.map((c) => (c.id === channelId ? { ...c, isFavorite: isFav } : c))
    );
  };

  // If no playlist exists or user explicitly requested onboarding
  if (!isLoading && (!activePlaylist || showOnboarding)) {
    return (
      <OnboardingFlow
        onComplete={() => {
          setShowOnboarding(false);
          refreshData();
        }}
        onOpenSettings={() => {
          setShowOnboarding(false);
          setActiveNavId('settings');
        }}
      />
    );
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[var(--md-sys-color-surface-dim)] text-[var(--md-sys-color-on-surface)] flex">
      {/* 10-Foot Collapsible Navigation Rail (hidden during fullscreen playback) */}
      {!playingChannel && (
        <NavigationRail
          destinations={NAV_DESTINATIONS}
          activeId={activeNavId}
          onSelect={(dest) => setActiveNavId(dest.id)}
        />
      )}

      {/* Main Content Workspace (padded to account for collapsed rail width 80px) */}
      {!playingChannel && (
        <main className="flex-1 ml-20 h-full flex flex-col overflow-hidden tv-safe-container">
          {activeNavId === 'home' && (
            <HomeView
              channels={channels}
              groups={groups}
              onSelectChannel={setPlayingChannel}
              onGoToLive={() => setActiveNavId('live')}
              onGoToGuide={() => setActiveNavId('guide')}
            />
          )}

          {activeNavId === 'live' && (
            <ChannelBrowser
              channels={channels}
              groups={groups}
              activeGroupId={activeGroupId}
              onSelectGroup={setActiveGroupId}
              onSelectChannel={setPlayingChannel}
              onToggleFavorite={handleToggleFavorite}
            />
          )}

          {activeNavId === 'guide' && (
            <EpgGuideView
              channels={channels}
              onSelectChannel={setPlayingChannel}
            />
          )}

          {activeNavId === 'favorites' && (
            <FavoritesView
              channels={channels}
              onSelectChannel={setPlayingChannel}
              onToggleFavorite={handleToggleFavorite}
              onGoToLive={() => setActiveNavId('live')}
            />
          )}

          {activeNavId === 'search' && (
            <SearchView
              channels={channels}
              onSelectChannel={setPlayingChannel}
              onToggleFavorite={handleToggleFavorite}
            />
          )}

          {activeNavId === 'settings' && (
            <SettingsView
              playlists={playlists}
              onAddNewPlaylist={() => setShowOnboarding(true)}
              onRefreshData={refreshData}
            />
          )}

          {activeNavId === 'gallery' && (
            <GalleryView />
          )}
        </main>
      )}

      {/* Full-Screen Video Player Overlay */}
      {playingChannel && (
        <PlayerView
          channel={playingChannel}
          allChannels={channels}
          allGroups={groups}
          onChannelChange={setPlayingChannel}
          onClose={() => setPlayingChannel(null)}
          onOpenGuide={() => {
            setPlayingChannel(null);
            setActiveNavId('guide');
          }}
          onOpenSearch={() => {
            setPlayingChannel(null);
            setActiveNavId('search');
          }}
          onOpenSettings={() => {
            setPlayingChannel(null);
            setActiveNavId('settings');
          }}
        />
      )}
    </div>
  );
}
