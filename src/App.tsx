import React, { Suspense, useEffect, useRef, useState, useCallback } from 'react';
import {
  initFocusEngine,
  getCurrentFocusKey,
  setFocus,
  focusKeyExists,
  rememberContentFocus,
  recallContentFocus,
  clearContentFocusMemory,
  isRailFocusKey,
} from './shared/focus/index.ts';
import { useTvInput, useIdleCursor } from './shared/input/index.ts';
import { NavigationRail, NavDestination, RemoteHintBar, AppSplash } from './shared/ui/index.ts';
import { useSettingsStore, applyTheme } from './app/settingsStore.ts';
import { useAppBoot } from './app/useAppBoot.ts';
import { EpgProvider } from './app/epgRuntime.tsx';
import { getActivePlaylist, getAllPlaylists, getChannelsByGroup, getGroupsForPlaylist, toggleChannelFavorite } from './services/storage/db.ts';
import { syncDemoPlaylistIfOutdated } from './services/playlist/demoPlaylist.ts';
import { Playlist, Channel, Group } from './domain/types.ts';

import { OnboardingFlow } from './features/onboarding/index.ts';
import { PlayerView } from './features/player/index.ts';
import { HomeView } from './features/home/index.ts';
import { ChannelBrowser } from './features/live-tv/index.ts';

// Lazy: the guide (2-axis virtualization) is only loaded when its rail
// destination is opened, keeping it out of the initial bundle.
const EpgGuideView = React.lazy(() =>
  import('./features/guide/EpgGuideView.tsx').then((module) => ({ default: module.EpgGuideView }))
);
import { FavoritesView } from './features/favorites/index.ts';
import { SearchView } from './features/search/index.ts';
import { SettingsView } from './features/settings/index.ts';

const NAV_DESTINATIONS: NavDestination[] = [
  { id: 'home', label: 'Home', icon: 'home', path: '/' },
  { id: 'live', label: 'Live TV', icon: 'live_tv', path: '/live' },
  { id: 'guide', label: 'EPG Guide', icon: 'calendar_month', path: '/guide' },
  { id: 'favorites', label: 'Favorites', icon: 'star', path: '/favorites' },
  { id: 'search', label: 'Search', icon: 'search', path: '/search' },
  { id: 'settings', label: 'Settings', icon: 'settings', path: '/settings' },
];

/**
 * Primary D-pad target for each destination, tried in order. Used when a
 * destination is activated from the rail so focus lands in the new content
 * rather than staying on the rail.
 */
const PRIMARY_FOCUS_TARGETS: Record<string, string[]> = {
  home: ['HERO_ACTIONS', 'ROW_LIVE', 'ROW_CATEGORIES'],
  live: ['CHANNEL_CATEGORIES', 'CHANNEL_GRID', 'CHANNEL_LIST'],
  guide: ['EPG_GRID', 'GUIDE_DAY_0'],
  favorites: ['FAVORITES_GRID'],
  search: ['SEARCH_FIELD'],
  // The settings screen has no single focusable container; the first D-pad
  // stop is the active tab tile.
  settings: ['SETTINGS_TAB_appearance'],
};

/**
 * Focus the first mounted primary target for a destination, if any.
 *
 * Settings has no single focusable container: its tabs row is a zone whose
 * children are the tab tiles, so the entry point is the active tab tile
 * itself (BUG-020).
 */
function focusPrimaryTarget(destinationId: string): void {
  clearContentFocusMemory();
  for (const key of PRIMARY_FOCUS_TARGETS[destinationId] ?? []) {
    if (focusKeyExists(key)) {
      setFocus(key);
      return;
    }
  }
}

export default function App() {
  const { settings } = useSettingsStore();

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

  /**
   * Read the playlists, the active playlist / onboarding decision and its
   * channels and groups. Also the "reload everything" action (EPG change,
   * Settings refresh, onboarding completion), so it never rejects: `useAppBoot`
   * owns the failure logging and the boot gate.
   */
  const loadDatabase = useCallback(async () => {
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
  }, []);

  const { isBooting, isLeaving, refreshData } = useAppBoot(loadDatabase);

  // Handle color keys shortcuts when not inside video player
  useTvInput((event) => {
    if (playingChannel) return; // Player has its own handlers

    // Ignore everything while the boot splash is up (ADR 022): these shortcuts
    // mutate the destination, so a remote pressed at the splash would land the
    // user in Settings or the Guide the moment it cleared.
    if (isBooting) return;

    // Remember where focus was in content so the rail can restore it later.
    const currentFocusKey = getCurrentFocusKey();
    if (!isRailFocusKey(currentFocusKey)) {
      rememberContentFocus(currentFocusKey);
    }

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
  }, [isBooting, playingChannel]);

  // Navigate from the rail. Activating the already-active destination is a
  // no-op that instead moves focus into the current screen's content.
  const handleNavigate = useCallback(
    (dest: NavDestination) => {
      if (dest.id === activeNavId) {
        const remembered = recallContentFocus();
        if (remembered) {
          setFocus(remembered);
        } else {
          focusPrimaryTarget(dest.id);
        }
        return;
      }
      clearContentFocusMemory();
      setActiveNavId(dest.id);
    },
    [activeNavId]
  );

  // Changing destinations must land focus on the new screen's primary target.
  // The screen mounts asynchronously, so retry for a short window instead of a
  // single tick: a miss used to leave focus on the navigation rail.
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    let cancelled = false;
    let attempts = 0;
    let raf = requestAnimationFrame(function tryFocus() {
      if (cancelled) return;
      for (const key of PRIMARY_FOCUS_TARGETS[activeNavId] ?? []) {
        if (focusKeyExists(key)) {
          setFocus(key);
          return;
        }
      }
      if (attempts++ < 120) raf = requestAnimationFrame(tryFocus);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [activeNavId]);

  const handleToggleFavorite = async (channelId: string) => {
    const isFav = await toggleChannelFavorite(channelId);
    setChannels((prev) =>
      prev.map((c) => (c.id === channelId ? { ...c, isFavorite: isFav } : c))
    );
  };

  // Cold boot: nothing else renders until the boot sequence settles, and the
  // splash stays on top while it fades out (ADR 022).
  if (isBooting && !isLeaving) {
    return <AppSplash />;
  }

  const leavingSplash = isLeaving ? <AppSplash leaving /> : null;

  // If no playlist exists or user explicitly requested onboarding
  if (!activePlaylist || showOnboarding) {
    return (
      <>
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
        {leavingSplash}
      </>
    );
  }

  return (
    <EpgProvider
      playlist={activePlaylist}
      channels={channels}
      proxyTemplate={settings.proxyUrlTemplate}
      ttlHours={settings.epgTtlHours}
      onChanged={refreshData}
    >
    <div className="relative w-screen h-screen overflow-hidden bg-[var(--md-sys-color-surface-dim)] text-[var(--md-sys-color-on-surface)] flex">
      {/* Permanent icon-only navigation rail (hidden during fullscreen playback). */}
      {!playingChannel && (
        <NavigationRail
          items={NAV_DESTINATIONS}
          activeId={activeNavId}
          onNavigate={handleNavigate}
        />
      )}

      {/* Main content workspace: flows to the right of the rail (never under it). */}
      {!playingChannel && (
        <main className="flex-1 min-w-0 h-full flex flex-col overflow-hidden tv-safe-container">
          <div className="flex-1 min-h-0 overflow-hidden">
            {activeNavId === 'home' && (
            <HomeView
              channels={channels}
              groups={groups}
              onSelectChannel={setPlayingChannel}
              onGoToLive={() => setActiveNavId('live')}
              onGoToCategory={(groupId) => {
                setActiveGroupId(groupId);
                setActiveNavId('live');
              }}
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
            <Suspense
              fallback={
                <div className="flex-1 flex items-center justify-center text-sm text-[var(--md-sys-color-outline)]">
                  Loading guide…
                </div>
              }
            >
              <EpgGuideView
                channels={channels}
                onSelectChannel={setPlayingChannel}
                onToggleFavorite={handleToggleFavorite}
                onOpenSettings={() => setActiveNavId('settings')}
              />
            </Suspense>
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
          </div>

          {/* Remote color-key legend lives in the content footer, not the rail. */}
          {settings.showRemoteHints && <RemoteHintBar />}
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
    {leavingSplash}
    </EpgProvider>
  );
}
