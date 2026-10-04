import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Channel, Playlist, Program } from '../domain/types.ts';
import { programProgress } from '../domain/epg/nowNext.ts';
import { createDexieEpgRepository, type EpgRepository } from '../services/epg/repository.ts';
import { refreshEpgSource } from '../services/epg/refresh.ts';
import { createEpgScheduler, type EpgScheduleStatus } from '../services/epg/scheduler.ts';
import { createNowNextService, type NowNextService } from '../services/epg/nowNextService.ts';

interface EpgRuntimeValue {
  repository: EpgRepository;
  nowNext: NowNextService;
  statuses: Record<string, EpgScheduleStatus>;
  /** Bumped after every successful refresh so Now/Next consumers re-query. */
  version: number;
  /** Minute-aligned ticker value for Now/Next progress. */
  minute: number;
  refresh: (sourceId?: string) => Promise<void>;
}

const EpgRuntimeContext = createContext<EpgRuntimeValue | null>(null);

export interface EpgProviderProps {
  playlist?: Playlist;
  channels: Channel[];
  proxyTemplate?: string;
  ttlHours?: number;
  repository?: EpgRepository;
  onChanged?: () => void;
  children: React.ReactNode;
}

/**
 * Owns the EPG background runtime: scheduler, Now/Next selector and status.
 * Refreshes on app start and on TTL expiry (stale-while-revalidate), pauses
 * while offline and resumes on `online`, and stops everything on unmount.
 */
export const EpgProvider: React.FC<EpgProviderProps> = ({
  playlist,
  channels,
  proxyTemplate,
  ttlHours,
  repository,
  onChanged,
  children,
}) => {
  const repo = useMemo(() => repository ?? createDexieEpgRepository(), [repository]);
  const nowNext = useMemo(() => createNowNextService(repo), [repo]);
  const [statuses, setStatuses] = useState<Record<string, EpgScheduleStatus>>({});
  const [version, setVersion] = useState(0);
  const [minute, setMinute] = useState(() => Math.floor(Date.now() / 60_000));

  const channelsRef = useRef(channels);
  channelsRef.current = channels;
  const proxyRef = useRef(proxyTemplate);
  proxyRef.current = proxyTemplate;
  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;
  const playlistRef = useRef(playlist);
  playlistRef.current = playlist;

  const scheduler = useMemo(
    () =>
      createEpgScheduler({
        repository: repo,
        ttlHours,
        refreshSource: async (source, signal) => {
          const currentPlaylist = playlistRef.current;
          if (!currentPlaylist) return;
          await refreshEpgSource({
            source,
            playlistId: currentPlaylist.id,
            channels: channelsRef.current,
            proxyTemplate: proxyRef.current,
            repository: repo,
            signal,
          });
          nowNext.invalidate();
          setVersion((value) => value + 1);
          onChangedRef.current?.();
        },
        onStatus: (sourceId, status) =>
          setStatuses((prev) => ({ ...prev, [sourceId]: status })),
      }),
    [repo, ttlHours, nowNext]
  );

  const playlistId = playlist?.id;

  useEffect(() => {
    if (!playlistId) return;
    void scheduler.schedule(playlistId);
    return () => scheduler.stop();
  }, [scheduler, playlistId]);

  // Offline: cancel timers; online: resume. Nothing runs after unmount.
  useEffect(() => {
    if (!playlistId) return;
    const onOnline = () => void scheduler.schedule(playlistId);
    const onOffline = () => scheduler.stop();
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [scheduler, playlistId]);

  useEffect(() => {
    const timer = setInterval(() => setMinute(Math.floor(Date.now() / 60_000)), 60_000);
    return () => clearInterval(timer);
  }, []);

  const refresh = useCallback(
    async (sourceId?: string) => {
      if (!playlistRef.current) return;
      await scheduler.refreshNow(playlistRef.current.id, sourceId);
    },
    [scheduler]
  );

  const value = useMemo<EpgRuntimeValue>(
    () => ({ repository: repo, nowNext, statuses, version, minute, refresh }),
    [repo, nowNext, statuses, version, minute, refresh]
  );

  return <EpgRuntimeContext.Provider value={value}>{children}</EpgRuntimeContext.Provider>;
};

export function useEpgRuntime(): EpgRuntimeValue | null {
  return useContext(EpgRuntimeContext);
}

export interface UseNowNextResult {
  current?: Program;
  next?: Program;
  /** 0..1 progress through the current programme. */
  progress: number;
}

/**
 * Per-channel Now/Next. Re-queries only when the channel, a refresh (version)
 * or the minute ticker changes, so lists are not re-rendered per second.
 */
export function useNowNext(channelId: string | undefined): UseNowNextResult {
  const runtime = useContext(EpgRuntimeContext);
  const nowNext = runtime?.nowNext;
  const version = runtime?.version ?? 0;
  const minute = runtime?.minute ?? 0;
  const [state, setState] = useState<UseNowNextResult>({ progress: 0 });

  useEffect(() => {
    if (!nowNext || !channelId) {
      setState({ progress: 0 });
      return;
    }
    let cancelled = false;
    void nowNext
      .getNowNext(channelId, Date.now())
      .then((result) => {
        if (cancelled) return;
        const now = Date.now();
        setState({
          current: result.current,
          next: result.next,
          progress: result.current ? programProgress(result.current, now) : 0,
        });
      })
      .catch(() => {
        if (!cancelled) setState({ progress: 0 });
      });
    return () => {
      cancelled = true;
    };
  }, [nowNext, channelId, version, minute]);

  return state;
}
