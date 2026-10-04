import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Channel, Program } from '../../domain/types.ts';
import { PlayerManager, PlayerManagerState } from '../../services/player/PlayerManager.ts';
import { getProgramsForChannel, addWatchHistory, toggleChannelFavorite } from '../../services/storage/db.ts';
import { useSettingsStore } from '../../app/settingsStore.ts';
import { useTvInput, pushBackHandler } from '../../shared/input/index.ts';
import { NowNextBanner } from './NowNextBanner.tsx';
import { PlayerControlsOverlay } from './PlayerControlsOverlay.tsx';
import { MiniChannelOverlay } from './MiniChannelOverlay.tsx';
import { NumberZapOverlay } from './NumberZapOverlay.tsx';
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
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerManagerRef = useRef<PlayerManager | null>(null);
  const { settings, updateSettings } = useSettingsStore();

  const [playerState, setPlayerState] = useState<PlayerManagerState>({
    status: 'loading',
    currentEngine: null,
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
  const [currentProgram, setCurrentProgram] = useState<Program | undefined>();
  const [nextProgram, setNextProgram] = useState<Program | undefined>();

  // Overlays visibility states
  const [showControls, setShowControls] = useState(false);
  const [showNowNext, setShowNowNext] = useState(true);
  const [showMiniList, setShowMiniList] = useState(false);
  const [showNerdStats, setShowNerdStats] = useState(settings.showNerdStats);
  const [showCorsModal, setShowCorsModal] = useState(false);
  const [isFavorite, setIsFavorite] = useState(!!channel.isFavorite);

  // Number Zap state
  const [zapDigits, setZapDigits] = useState('');
  const zapTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-hide timers
  const controlsTimerRef = useRef<NodeJS.Timeout | null>(null);
  const nowNextTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  // Fetch current & next EPG program for channel
  useEffect(() => {
    let isMounted = true;
    const loadEpg = async () => {
      const now = Date.now();
      const programs = await getProgramsForChannel(channel.id, now - 3600000, now + 14400000);
      if (!isMounted) return;

      const curr = programs.find(p => p.start <= now && p.stop >= now);
      const next = programs.find(p => p.start > now);
      setCurrentProgram(curr);
      setNextProgram(next);
    };

    loadEpg();
    setIsFavorite(!!channel.isFavorite);
    triggerNowNextBanner();

    // Record watch history
    addWatchHistory({
      channelId: channel.id,
      name: channel.name,
      logo: channel.logo,
      streamUrl: channel.streamUrl,
    });

    return () => { isMounted = false; };
  }, [channel, triggerNowNextBanner]);

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

    if (event.action === 'DIGIT' && event.digit !== undefined) {
      const newDigits = zapDigits + event.digit;
      setZapDigits(newDigits);

      if (zapTimerRef.current) clearTimeout(zapTimerRef.current);
      zapTimerRef.current = setTimeout(() => {
        const targetNum = parseInt(newDigits, 10);
        const matched = allChannels.find(c => c.number === targetNum);
        if (matched) {
          onChannelChange(matched);
        }
        setZapDigits('');
      }, 2000);
      return true;
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

    if (event.action === 'INFO') {
      setShowNowNext(true);
      setShowNerdStats(prev => !prev);
      return true;
    }

    // Color keys
    if (event.action === 'COLOR_RED') {
      toggleChannelFavorite(channel.id).then(setIsFavorite);
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
  }, [allChannels, channel, playerState.status, zapDigits, showMiniList, showControls, showNerdStats, zapToNext, zapToPrev, resetControlsTimer, onChannelChange, onOpenGuide, onOpenSearch, onOpenSettings]);

  // Aspect ratio class mapper
  let videoObjectFit = 'object-contain';
  if (aspectRatio === 'fill') videoObjectFit = 'object-fill';
  if (aspectRatio === 'zoom') videoObjectFit = 'object-cover';

  const cycleAspectRatio = () => {
    const list: ('fit' | 'fill' | '16:9' | '4:3' | 'zoom')[] = ['fit', 'fill', '16:9', '4:3', 'zoom'];
    const next = list[(list.indexOf(aspectRatio) + 1) % list.length];
    setAspectRatio(next);
  };

  const matchedZapChannel = zapDigits
    ? allChannels.find(c => c.number === parseInt(zapDigits, 10))?.name
    : undefined;

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
          <div className="max-w-xl w-full bg-[var(--md-sys-color-surface-container-high)] p-8 rounded-3xl border border-red-900/60 shadow-2xl flex flex-col gap-5 text-center text-[var(--md-sys-color-on-surface)]">
            <div className="w-16 h-16 rounded-2xl bg-red-950 text-red-400 mx-auto flex items-center justify-center shadow-inner">
              <Icon name="error_outline" size={36} />
            </div>

            <div>
              <h2 className="text-2xl font-bold tracking-tight mb-2">Stream Unavailable</h2>
              <p className="text-xs font-mono text-red-300 break-all p-3 rounded-xl bg-black/40 border border-red-900/40">
                {playerState.error}
              </p>
              {playerState.isMixedContent && (
                <p className="text-xs text-amber-300 mt-2">
                  Insecure HTTP stream blocked on secure HTTPS page. Using a CORS proxy solves this.
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
                  className="bg-amber-400 hover:bg-amber-300 text-black font-bold shadow-lg"
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

      {/* Number Zapping Overlay */}
      <NumberZapOverlay
        digits={zapDigits}
        matchedChannelName={matchedZapChannel}
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
