import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Channel } from '../../domain/types.ts';
import { PlayerManager, PlayerManagerState } from '../../services/player/PlayerManager.ts';
import { addWatchHistory, toggleChannelFavorite } from '../../services/storage/db.ts';
import { playChannelSwitchSound } from '../../services/audio/index.ts';
import { useSettingsStore } from '../../app/settingsStore.ts';
import { useNowNext } from '../../app/epgRuntime.tsx';
import { useTvInput, pushBackHandler } from '../../shared/input/index.ts';
import { isChannelNumberEntryActive } from '../../shared/channel-number/index.ts';
import { NowNextBanner } from './NowNextBanner.tsx';
import { PlayerControlsOverlay } from './PlayerControlsOverlay.tsx';
import { MiniChannelOverlay } from './MiniChannelOverlay.tsx';
import { NerdStatsOverlay } from './NerdStatsOverlay.tsx';
import { CorsDiagnosticModal } from '../onboarding/CorsDiagnosticModal.tsx';
import { Button, CircularProgress } from '../../shared/ui/index.ts';
import { Icon } from '../../shared/icons/index.ts';
import { Group } from '../../domain/types.ts';
import { shouldYieldDpadToOverlay } from './dpadOverlayPolicy.ts';

export interface PlayerViewProps {
  channel: Channel;
  allChannels: Channel[];
  allGroups: Group[];
  onChannelChange: (newChannel: Channel) => void;
  onClose: () => void;
  onOpenSettings?: () => void;
  onOpenGuide?: () => void;
  onOpenSearch?: () => void;
  /** Toggle a channel's favourite state; returns the new state. */
  onToggleFavorite?: (channelId: string) => Promise<boolean> | boolean | void;
}

export const PlayerView: React.FC<PlayerViewProps> = ({
  channel,
  allChannels,
  allGroups,
  onChannelChange,
  onClose,
  onOpenSettings,
  onOpenGuide,
  onOpenSearch,
  onToggleFavorite,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerManagerRef = useRef<PlayerManager | null>(null);
  const { settings, updateSettings } = useSettingsStore();

  const [playerState, setPlayerState] = useState<PlayerManagerState>({
    status: 'loading',
    currentEngine: null,
    transport: 'direct',
    error: null,
    isBuffering: true,
    stats: null,
    retryCount: 0,
    engineIndex: 0,
    totalEngines: 0,
    isMixedContent: false,
    isCorsRisk: false,
  });

  const [aspectRatio, setAspectRatio] = useState<'fit' | 'fill' | '16:9' | '4:3' | 'zoom'>('fit');

  // Overlays visibility states
  const [showControls, setShowControls] = useState(false);
  const [showNowNext, setShowNowNext] = useState(true);
  const [showMiniList, setShowMiniList] = useState(false);
  const [showNerdStats, setShowNerdStats] = useState(settings.showNerdStats);
  const [showCorsModal, setShowCorsModal] = useState(false);
  const [isFavorite, setIsFavorite] = useState(!!channel.isFavorite);

  // Now/Next comes from the shared EPG selector (one query + minute ticker).
  const { current: currentProgram, next: nextProgram } = useNowNext(channel.id);

  // Auto-hide timers
  const controlsTimerRef = useRef<NodeJS.Timeout | null>(null);
  const nowNextTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Last channel id rendered, so the switch blip fires exactly once per
  // channel, including the tune-in on first mount. See the effect below.
  const previousChannelIdRef = useRef<string | null>(null);

  const resetControlsTimer = useCallback(() => {
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => {
      setShowControls(false);
    }, 5000);
  }, []);

  const triggerNowNextBanner = useCallback(() => {
    setShowNowNext(true);
    if (nowNextTimerRef.current) clearTimeout(nowNextTimerRef.current);
    nowNextTimerRef.current = setTimeout(() => {
      setShowNowNext(false);
    }, 4500);
  }, []);

  // Record watch history and show the Now/Next banner on channel change.
  useEffect(() => {
    setIsFavorite(!!channel.isFavorite);
    triggerNowNextBanner();

    addWatchHistory({
      channelId: channel.id,
      name: channel.name,
      logo: channel.logo,
      streamUrl: channel.streamUrl,
    });
  }, [channel, triggerNowNextBanner]);

  // Channel-switch confirmation tone. Keyed on the channel id alone so the
  // blip fires for every way a channel becomes active: selecting a card,
  // CH_UP/CH_DOWN, the number zap and the mini channel list. A new channel id
  // on first mount is a tune-in, which is a channel switch from the viewer's
  // point of view, so it gets the tone too. Toggling the preference while the
  // player is open must not replay it (the id has not changed).
  useEffect(() => {
    const previousChannelId = previousChannelIdRef.current;
    previousChannelIdRef.current = channel.id;
    if (previousChannelId === channel.id) return;
    if (settings.channelSwitchSound) playChannelSwitchSound();
  }, [channel.id, settings.channelSwitchSound]);

  // Initialize and load stream
  useEffect(() => {
    if (!videoRef.current) return;

    const manager = new PlayerManager({
      preferredEngine: settings.defaultEngine,
      proxyUrlTemplate: settings.proxyUrlTemplate,
      onStateChange: (state) => {
        setPlayerState(state);
      },
    });
    playerManagerRef.current = manager;

    manager.loadStream(videoRef.current, channel.streamUrl);

    return () => {
      manager.destroy();
      playerManagerRef.current = null;
    };
  }, [channel.streamUrl, settings.defaultEngine, settings.proxyUrlTemplate]);

  // Back button handler: closes overlays first, then exits player
  useEffect(() => {
    return pushBackHandler(() => {
      if (showMiniList) {
        setShowMiniList(false);
        return true;
      }
      if (showControls) {
        setShowControls(false);
        return true;
      }
      if (showNerdStats) {
        setShowNerdStats(false);
        return true;
      }
      onClose();
      return true;
    });
  }, [showMiniList, showControls, showNerdStats, onClose]);

  // Channel zapping helpers
  const zapToNext = useCallback(() => {
    const currentIndex = allChannels.findIndex(c => c.id === channel.id);
    if (currentIndex !== -1 && allChannels.length > 1) {
      const nextIndex = (currentIndex + 1) % allChannels.length;
      onChannelChange(allChannels[nextIndex]);
    }
  }, [allChannels, channel.id, onChannelChange]);

  const zapToPrev = useCallback(() => {
    const currentIndex = allChannels.findIndex(c => c.id === channel.id);
    if (currentIndex !== -1 && allChannels.length > 1) {
      const prevIndex = (currentIndex - 1 + allChannels.length) % allChannels.length;
      onChannelChange(allChannels[prevIndex]);
    }
  }, [allChannels, channel.id, onChannelChange]);

  // Remote key normalization handlers
  useTvInput((event) => {
    if (showMiniList) return; // Allow mini list to handle its own navigation

    // The app-level number entry owns OK while digits are pending: committing
    // the number must not also toggle the controls overlay.
    if (event.action === 'SELECT' && isChannelNumberEntryActive()) return true;

    // When an overlay owns focus (controls or error recovery), let the
    // spatial-navigation engine move focus. Otherwise arrow keys both moved
    // control focus AND zapped channels on every press.
    if (
      shouldYieldDpadToOverlay(showControls, playerState.status) &&
      (event.action === 'NAV_UP' ||
        event.action === 'NAV_DOWN' ||
        event.action === 'NAV_LEFT' ||
        event.action === 'NAV_RIGHT' ||
        event.action === 'SELECT')
    ) {
      resetControlsTimer();
      return;
    }

    if (event.action === 'NAV_UP' || event.action === 'CH_UP') {
      zapToNext();
      return true;
    }
    if (event.action === 'NAV_DOWN' || event.action === 'CH_DOWN') {
      zapToPrev();
      return true;
    }
    if (event.action === 'NAV_LEFT') {
      setShowMiniList(true);
      return true;
    }
    if (event.action === 'NAV_RIGHT' || event.action === 'SELECT') {
      setShowControls(prev => !prev);
      resetControlsTimer();
      return true;
    }

    if (event.action === 'PLAY_PAUSE') {
      if (playerState.status === 'playing') playerManagerRef.current?.pause();
      else playerManagerRef.current?.play();
      return true;
    }
    if (event.action === 'PAUSE') {
      playerManagerRef.current?.pause();
      return true;
    }
    if (event.action === 'PLAY') {
      playerManagerRef.current?.play();
      return true;
    }

    if (event.action === 'INFO') {
      setShowNowNext(true);
      setShowNerdStats(prev => !prev);
      return true;
    }

    // Color keys
    if (event.action === 'COLOR_RED') {
      // Route through the shell when it provides the callback so the channel
      // list in App state updates immediately; otherwise fall back to the DB.
      if (onToggleFavorite) {
        const result = onToggleFavorite(channel.id);
        void Promise.resolve(result).then((next) => {
          setIsFavorite((prev) => (typeof next === 'boolean' ? next : !prev));
        });
      } else {
        void toggleChannelFavorite(channel.id).then(setIsFavorite);
      }
      return true;
    }
    if (event.action === 'COLOR_GREEN' && onOpenGuide) {
      onOpenGuide();
      return true;
    }
    if (event.action === 'COLOR_YELLOW' && onOpenSearch) {
      onOpenSearch();
      return true;
    }
    if (event.action === 'COLOR_BLUE' && onOpenSettings) {
      onOpenSettings();
      return true;
    }
  }, [allChannels, channel, playerState.status, showMiniList, showControls, showNerdStats, zapToNext, zapToPrev, resetControlsTimer, onChannelChange, onOpenGuide, onOpenSearch, onOpenSettings, onToggleFavorite]);

  // Aspect ratio class mapper
  let videoObjectFit = 'object-contain';
  if (aspectRatio === 'fill') videoObjectFit = 'object-fill';
  if (aspectRatio === 'zoom') videoObjectFit = 'object-cover';

  const cycleAspectRatio = () => {
    const list: ('fit' | 'fill' | '16:9' | '4:3' | 'zoom')[] = ['fit', 'fill', '16:9', '4:3', 'zoom'];
    const next = list[(list.indexOf(aspectRatio) + 1) % list.length];
    setAspectRatio(next);
  };

  const handleCycleEngine = () => {
    const cycleEngines: ('hls' | 'mpegts' | 'native')[] = ['hls', 'mpegts', 'native'];
    const cur = playerState.currentEngine || 'hls';
    const nextEngine = cycleEngines[(cycleEngines.indexOf(cur) + 1) % cycleEngines.length];
    playerManagerRef.current?.forceEngine(nextEngine);
  };

  const handleQuickEnableProxy = () => {
    const defaultProxy = 'https://corsproxy.io/?url={url}';
    updateSettings({ proxyUrlTemplate: defaultProxy });
    playerManagerRef.current?.retryWithProxy(defaultProxy);
  };

  return (
    <div
      className="fixed inset-0 z-50 w-screen h-screen bg-black overflow-hidden select-none"
      onClick={() => {
        setShowControls(prev => !prev);
        resetControlsTimer();
      }}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        playsInline
        className={`w-full h-full bg-black ${videoObjectFit}`}
      />

      {/* Buffering Spinner */}
      {playerState.isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none z-30">
          <div className="flex flex-col items-center gap-3 p-6 rounded-3xl bg-black/75 backdrop-blur-md">
            <CircularProgress size={52} />
            <span className="text-sm font-semibold tracking-wide text-white">
              Buffering stream...
            </span>
          </div>
        </div>
      )}

      {/* Error Overlay with Actionable Recovery */}
      {playerState.status === 'error' && playerState.error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/85 p-8 z-40">
          <div className="max-w-xl w-full bg-[var(--md-sys-color-surface-container-high)] p-8 rounded-3xl border border-[var(--md-sys-color-error)] shadow-2xl flex flex-col gap-5 text-center text-[var(--md-sys-color-on-surface)]">
            <div className="w-16 h-16 rounded-2xl status-live-surface text-[var(--md-sys-color-error)] mx-auto flex items-center justify-center shadow-inner">
              <Icon name="error_outline" size={36} />
            </div>

            <div>
              <h2 className="text-2xl font-bold tracking-tight mb-2">Stream Unavailable</h2>
              <p className="text-xs font-mono text-[var(--md-sys-color-error)] break-all p-3 rounded-xl bg-black/40 border border-[var(--md-sys-color-error)]">
                {playerState.error}
              </p>
              {playerState.isMixedContent && (
                <p className="text-xs text-[var(--sw-status-favorite)] mt-2">
                  Insecure HTTP stream blocked on secure HTTPS page. Using a CORS proxy solves this.
                </p>
              )}
              {!playerState.isMixedContent && playerState.transport === 'proxied' && (
                <p className="text-xs text-[var(--sw-status-favorite)] mt-2">
                  Direct playback failed and the CORS proxy configured in Settings did not respond
                  either — it may be down or blocking this provider. Check Settings → Network.
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2.5">
              {!settings.proxyUrlTemplate && (
                <Button
                  variant="filled"
                  icon="bolt"
                  autoFocus
                  onClick={handleQuickEnableProxy}
                  className="bg-[var(--sw-status-favorite)] hover:brightness-110 text-[var(--md-sys-color-surface-dim)] font-bold shadow-lg"
                >
                  Try with CORS Proxy
                </Button>
              )}

              <Button
                variant={settings.proxyUrlTemplate ? 'filled' : 'tonal'}
                icon="refresh"
                autoFocus={!!settings.proxyUrlTemplate}
                onClick={() => {
                  if (videoRef.current) {
                    playerManagerRef.current?.loadStream(videoRef.current, channel.streamUrl);
                  }
                }}
              >
                Retry
              </Button>

              <Button
                variant="tonal"
                icon="swap_horiz"
                onClick={handleCycleEngine}
              >
                Engine: {playerState.currentEngine?.toUpperCase() || 'AUTO'}
              </Button>

              <Button
                variant="outlined"
                icon="help_outline"
                onClick={() => setShowCorsModal(true)}
              >
                Diagnostics & Presets
              </Button>

              <Button
                variant="tonal"
                icon="skip_next"
                onClick={zapToNext}
              >
                Next Channel
              </Button>

              <Button
                variant="text"
                onClick={onClose}
              >
                Exit Player
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Now & Next Program Banner */}
      <NowNextBanner
        channel={channel}
        currentProgram={currentProgram}
        nextProgram={nextProgram}
        resolution={playerState.stats?.resolution}
        isVisible={showNowNext && !showControls && playerState.status !== 'error'}
      />

      {/* Full Player Controls Overlay */}
      <PlayerControlsOverlay
        isVisible={showControls}
        isPlaying={playerState.status === 'playing'}
        aspectRatio={aspectRatio}
        onTogglePlay={() => {
          if (playerState.status === 'playing') playerManagerRef.current?.pause();
          else playerManagerRef.current?.play();
          resetControlsTimer();
        }}
        onToggleMiniChannelList={() => {
          setShowControls(false);
          setShowMiniList(true);
        }}
        onCycleAspectRatio={() => {
          cycleAspectRatio();
          resetControlsTimer();
        }}
        onToggleNerdStats={() => {
          setShowNerdStats(prev => !prev);
          resetControlsTimer();
        }}
        onTogglePiP={async () => {
          try {
            if (document.pictureInPictureElement) {
              await document.exitPictureInPicture();
            } else if (videoRef.current) {
              await videoRef.current.requestPictureInPicture();
            }
          } catch (e) {
            console.warn('PiP error:', e);
          }
        }}
        onToggleFullscreen={() => {
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
          } else {
            document.exitFullscreen().catch(() => {});
          }
        }}
        onPrevChannel={zapToPrev}
        onNextChannel={zapToNext}
        stats={playerState.stats}
        audioTracks={playerManagerRef.current?.getAudioTracks() || []}
        subtitleTracks={playerManagerRef.current?.getSubtitleTracks() || []}
        onSelectAudioTrack={(id) => playerManagerRef.current?.setAudioTrack(id)}
        onSelectSubtitleTrack={(id) => playerManagerRef.current?.setSubtitleTrack(id)}
      />

      {/* Slide-in Mini Channel List Drawer */}
      <MiniChannelOverlay
        isOpen={showMiniList}
        onClose={() => setShowMiniList(false)}
        channels={allChannels}
        groups={allGroups}
        activeChannelId={channel.id}
        onSelectChannel={(newCh) => {
          onChannelChange(newCh);
          setShowMiniList(false);
        }}
      />

      {/* Nerd Stats Overlay */}
      <NerdStatsOverlay
        stats={playerState.stats}
        streamUrl={channel.streamUrl}
        isVisible={showNerdStats}
        onClose={() => setShowNerdStats(false)}
      />

      {/* CORS Diagnostic Modal */}
      <CorsDiagnosticModal
        isOpen={showCorsModal}
        onClose={() => setShowCorsModal(false)}
        failedUrl={channel.streamUrl}
        errorDetails={playerState.error || undefined}
        onRetryWithProxy={(template) => {
          playerManagerRef.current?.retryWithProxy(template);
        }}
        onTryDemo={() => {
          setShowCorsModal(false);
          onClose();
        }}
        onOpenSettings={() => {
          setShowCorsModal(false);
          onOpenSettings?.();
        }}
      />
    </div>
  );
};
