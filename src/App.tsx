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
import { ChannelNumberEntryHost } from './shared/channel-number/index.ts';
import { NavigationRail, NavDestination, ContentFooter, AppSplash } from './shared/ui/index.ts';
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
import { SettingsView } from './features/settings/index.ts';

const NAV_DESTINATIONS: NavDestination[] = [
  { id: 'home', label: 'Home', icon: 'home', path: '/' },
  { id: 'live', label: 'Live TV', icon: 'live_tv', path: '/live' },
  { id: 'guide', label: 'EPG Guide', icon: 'calendar_month', path: '/guide' },
  { id: 'favorites', label: 'Favorites', icon: 'star', path: '/favorites' },
  { id: 'settings', label: 'Settings', icon: 'settings', path: '/settings' },
];

/**
 * Primary D-pad target for each destination, tried in order. Used when a
 * destination is activated from the rail so focus lands in the new content
 * rather than staying on the rail.
 */
const PRIMARY_FOCUS_TARGETS: Record<string, string[]> = {
  home: ['HERO_ACTIONS', 'ROW_LIVE', 'ROW_CATEGORIES', 'HOME_SEARCH_FIELD'],
  live: ['CHANNEL_CATEGORIES', 'LIVE_SEARCH_FIELD', 'CHANNEL_GRID', 'CHANNEL_LIST'],
  guide: ['EPG_GRID', 'GUIDE_DAY_0'],
  favorites: ['FAVORITES_GRID', 'FAVORITES_SEARCH_FIELD'],
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

/**
 * Channel id of the control currently under the focus ring, if any. Root
 * focusables that represent a channel expose `data-channel-id`, which lets the
 * Red remote key act on the focused item without every screen wiring its own
 * shortcut handler.
 */
function getFocusedChannelId(): string | null {
  if (typeof document === 'undefined') return null;
  const focusedEl = document.querySelector<HTMLElement>(
    '[data-focused="true"][data-channel-id]'
  );
  return focusedEl?.dataset.channelId ?? null;
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

  // Focus key the next destination mount must land on, ahead of the usual
  // primary targets (used by the Yellow key's route into Live TV search).
  const pendingFocusRef = useRef<string | null>(null);

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

  const handleToggleFavorite = useCallback(async (channelId: string): Promise<boolean> => {
    const isFav = await toggleChannelFavorite(channelId);
    setChannels((prev) =>
      prev.map((c) => (c.id === channelId ? { ...c, isFavorite: isFav } : c))
    );
    return isFav;
  }, []);

  /**
   * Focus `key` once its screen has mounted. Used when the destination is
   * already active (e.g. Yellow inside the player), where the usual
   * destination-change effect does not re-run.
   */
  const focusWhenReady = useCallback((key: string, attempt = 0) => {
    if (focusKeyExists(key)) {
      if (pendingFocusRef.current === key) pendingFocusRef.current = null;
      setFocus(key);
      return;
    }
    if (attempt >= 120) return;
    requestAnimationFrame(() => focusWhenReady(key, attempt + 1));
  }, []);

  /**
   * Yellow: focus the inline search field of the current screen. Guide and
   * Settings have no field, so they route to Live TV with the full channel
   * scope and land on its search field rather than the category chips.
   */
  const openSearch = useCallback(() => {
    const fieldForNav: Record<string, string | undefined> = {
      home: 'HOME_SEARCH_FIELD',
      live: 'LIVE_SEARCH_FIELD',
      favorites: 'FAVORITES_SEARCH_FIELD',
    };
    const field = fieldForNav[activeNavId];
    if (field && focusKeyExists(field)) {
      setFocus(field);
      return;
    }

    const alreadyLive = activeNavId === 'live';
    pendingFocusRef.current = 'LIVE_SEARCH_FIELD';
    setActiveGroupId('all');
    setActiveNavId('live');
    if (alreadyLive) focusWhenReady('LIVE_SEARCH_FIELD');
  }, [activeNavId, focusWhenReady]);

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
      // Pin/unpin the channel under the focus ring. Cards and guide cells carry
      // `data-channel-id`; when focus is not on a channel (rail, chips, hero
      // actions) Red keeps its original job as the Favorites shortcut.
      const focusedChannelId = getFocusedChannelId();
      if (focusedChannelId) {
        void handleToggleFavorite(focusedChannelId);
        return true;
      }
      setActiveNavId('favorites');
      return true;
    }
    if (event.action === 'COLOR_GREEN') {
      setActiveNavId('guide');
      return true;
    }
    if (event.action === 'COLOR_YELLOW') {
      openSearch();
      return true;
    }
    if (event.action === 'COLOR_BLUE') {
      setActiveNavId('settings');
      return true;
    }
  }, [handleToggleFavorite, isBooting, playingChannel, openSearch]);

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
      pendingFocusRef.current = null;
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
    // A pending target (Yellow → Live TV search) outranks the usual primary
    // targets for this destination. Read it once and clear it so a later
    // destination change cannot inherit it.
    const pending = pendingFocusRef.current;
    pendingFocusRef.current = null;
    let raf = requestAnimationFrame(function tryFocus() {
      if (cancelled) return;
      const targets = pending
        ? [pending, ...(PRIMARY_FOCUS_TARGETS[activeNavId] ?? [])]
        : PRIMARY_FOCUS_TARGETS[activeNavId] ?? [];
      for (const key of targets) {
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
              onToggleFavorite={handleToggleFavorite}
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

          {activeNavId === 'settings' && (
            <SettingsView
              playlists={playlists}
              onAddNewPlaylist={() => setShowOnboarding(true)}
              onRefreshData={refreshData}
            />
          )}
          </div>

          {/* Color-key legend + attribution share the content footer row. The
              credit stays visible when the legend is disabled in Settings. */}
          <ContentFooter showRemoteHints={settings.showRemoteHints} />
        </main>
      )}

      {/* Full-Screen Video Player Overlay */}
      {playingChannel && (
        <PlayerView
          channel={playingChannel}
          allChannels={channels}
          allGroups={groups}
          onChannelChange={setPlayingChannel}
          onToggleFavorite={handleToggleFavorite}
          onClose={() => setPlayingChannel(null)}
          onOpenGuide={() => {
            setPlayingChannel(null);
            setActiveNavId('guide');
          }}
          onOpenSearch={() => {
            setPlayingChannel(null);
            setActiveGroupId('all');
            setActiveNavId('live');
            pendingFocusRef.current = 'LIVE_SEARCH_FIELD';
            focusWhenReady('LIVE_SEARCH_FIELD');
          }}
          onOpenSettings={() => {
            setPlayingChannel(null);
            setActiveNavId('settings');
          }}
        />
      )}

      {/*
       * One direct-number-entry handler + overlay for the whole app. It is
       * mounted here (outside the screen switch, inside the player's stacking
       * context) so Home, Live TV, Guide, Favorites and playback share the
       * exact same behaviour. The per-screen action and timing live in
       * shared/channel-number/config.ts.
       */}
      <ChannelNumberEntryHost
        channels={channels}
        screen={playingChannel ? 'player' : activeNavId}
        onTune={setPlayingChannel}
        disabled={isBooting}
      />
    </div>
    {leavingSplash}
    </EpgProvider>
  );
}
