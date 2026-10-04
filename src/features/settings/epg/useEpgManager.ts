import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Channel, EpgChannel, EpgMapping, EpgSource, Playlist } from '../../../domain/types.ts';
import { createDexieEpgRepository, type EpgRepository } from '../../../services/epg/repository.ts';
import { refreshEpgSource } from '../../../services/epg/refresh.ts';
import { detectEpgSources, type EpgSuggestion } from '../../../services/epg/detect.ts';
import { buildEpgMatchReport } from '../../../services/epg/matchReport.ts';
import { fetchEpgFile, readStreamText } from '../../../services/epg/fetcher.ts';
import { toUserStorageMessage } from '../../../services/storage/db.ts';

export type EpgPhase = 'idle' | 'downloading' | 'parsing' | 'ready' | 'failed';

export interface EpgStatus {
  phase: EpgPhase;
  bytesReceived: number;
  totalBytes?: number;
  programmesKept: number;
  updatedAt?: number;
  message?: string;
}

export interface EpgManagerOptions {
  playlist: Playlist;
  channels: Channel[];
  repository?: EpgRepository;
  proxyTemplate?: string;
  retention?: { pastMs?: number; futureMs?: number };
  onChanged?: () => void;
}

const IDLE_STATUS: EpgStatus = { phase: 'idle', bytesReceived: 0, programmesKept: 0 };

export function useEpgManager(options: EpgManagerOptions) {
  const { playlist, channels, repository, proxyTemplate, retention, onChanged } = options;
  const repo = useMemo(
    () => repository ?? createDexieEpgRepository(),
    [repository]
  );

  const [sources, setSources] = useState<EpgSource[]>([]);
  const [mappings, setMappings] = useState<EpgMapping[]>([]);
  const [epgChannels, setEpgChannels] = useState<EpgChannel[]>([]);
  const [status, setStatus] = useState<EpgStatus>(IDLE_STATUS);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshingSourceId, setRefreshingSourceId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<EpgSuggestion[]>([]);
  const [detecting, setDetecting] = useState(false);

  const reload = useCallback(async () => {
    const loadedSources = await repo.listSources(playlist.id);
    const loadedMappings = await repo.listMappings(playlist.id);
    const channelLists = await Promise.all(
      loadedSources.map((source) => repo.listEpgChannels(source.id))
    );
    setSources(loadedSources);
    setMappings(loadedMappings);
    setEpgChannels(channelLists.flat());
    setLoading(false);
  }, [repo, playlist.id]);

  useEffect(() => {
    setLoading(true);
    void reload();
  }, [reload]);

  const report = useMemo(
    () => buildEpgMatchReport(channels, epgChannels, mappings),
    [channels, epgChannels, mappings]
  );

  const fail = useCallback((err: unknown) => {
    setError(toUserStorageMessage(err) ?? (err instanceof Error ? err.message : String(err)));
  }, []);

  const addSource = useCallback(
    async (input: { name: string; url: string; kind: EpgSource['kind'] }) => {
      const source: EpgSource = {
        id: `epgsrc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        playlistId: playlist.id,
        name: input.name,
        url: input.url || undefined,
        kind: input.kind,
        enabled: true,
        priority: sources.length,
        channelCount: 0,
        programmeCount: 0,
      };
      await repo.putSource(source);
      await reload();
    },
    [repo, playlist.id, sources.length, reload]
  );

  const removeSource = useCallback(
    async (sourceId: string) => {
      await repo.deleteSource(sourceId);
      await reload();
      onChanged?.();
    },
    [repo, reload, onChanged]
  );

  const setSourceEnabled = useCallback(
    async (sourceId: string, enabled: boolean) => {
      const source = sources.find((s) => s.id === sourceId);
      if (!source) return;
      await repo.putSource({ ...source, enabled });
      await reload();
    },
    [repo, sources, reload]
  );

  const moveSource = useCallback(
    async (sourceId: string, direction: -1 | 1) => {
      const index = sources.findIndex((s) => s.id === sourceId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= sources.length) return;
      const reordered = [...sources];
      [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
      await Promise.all(reordered.map((source, i) => repo.putSource({ ...source, priority: i })));
      await reload();
    },
    [repo, sources, reload]
  );

  const clearAll = useCallback(async () => {
    for (const source of sources) await repo.deleteSource(source.id);
    await reload();
    onChanged?.();
  }, [repo, sources, reload, onChanged]);

  const runRefresh = useCallback(
    async (source: EpgSource, text?: string) => {
      setRefreshingSourceId(source.id);
      setError(null);
      setStatus({ phase: 'downloading', bytesReceived: 0, programmesKept: 0 });
      try {
        const summary = await refreshEpgSource({
          source,
          playlistId: playlist.id,
          channels,
          proxyTemplate,
          retention,
          text,
          repository: repo,
          onProgress: (progress) => {
            setStatus({
              phase: progress.programmesKept > 0 ? 'parsing' : 'downloading',
              bytesReceived: progress.bytes,
              programmesKept: progress.programmesKept,
            });
          },
        });
        setStatus({
          phase: 'ready',
          bytesReceived: 0,
          programmesKept: summary.programmes,
          updatedAt: Date.now(),
          message: summary.notModified ? 'Already up to date.' : undefined,
        });
        await reload();
        onChanged?.();
      } catch (err) {
        setStatus({ phase: 'failed', bytesReceived: 0, programmesKept: 0 });
        fail(err);
      } finally {
        setRefreshingSourceId(null);
      }
    },
    [channels, playlist.id, proxyTemplate, retention, repo, reload, onChanged, fail]
  );

  const refresh = useCallback(
    async (sourceId?: string) => {
      const enabled = sources.filter((s) => s.enabled);
      const targets = sourceId ? enabled.filter((s) => s.id === sourceId) : enabled;
      for (const source of targets) await runRefresh(source);
    },
    [sources, runRefresh]
  );

  const importFile = useCallback(
    async (file: File) => {
      const source: EpgSource = {
        id: `epgsrc_file_${Date.now()}`,
        playlistId: playlist.id,
        name: file.name,
        kind: 'file',
        enabled: true,
        priority: sources.length,
        channelCount: 0,
        programmeCount: 0,
      };
      try {
        const stream = await fetchEpgFile(file);
        const text = await readStreamText(stream.stream);
        await repo.putSource(source);
        await runRefresh(source, text);
      } catch (err) {
        fail(err);
      }
    },
    [repo, playlist.id, sources.length, runRefresh, fail]
  );

  const detect = useCallback(async () => {
    setDetecting(true);
    setError(null);
    try {
      setSuggestions(await detectEpgSources(playlist, { proxyTemplate }));
    } catch (err) {
      fail(err);
    } finally {
      setDetecting(false);
    }
  }, [playlist, proxyTemplate, fail]);

  const mapChannel = useCallback(
    async (channelId: string, epgChannel: EpgChannel) => {
      await repo.putMapping({
        channelId,
        playlistId: playlist.id,
        sourceId: epgChannel.sourceId,
        epgChannelId: epgChannel.id,
        xmltvId: epgChannel.xmltvId,
        method: 'manual',
        confidence: 1,
        manual: true,
        updatedAt: Date.now(),
      });
      await reload();
    },
    [repo, playlist.id, reload]
  );

  const unmapChannel = useCallback(
    async (channelId: string) => {
      await repo.deleteMapping(channelId);
      await reload();
    },
    [repo, reload]
  );

  return {
    sources,
    mappings,
    epgChannels,
    report,
    status,
    error,
    loading,
    refreshingSourceId,
    suggestions,
    detecting,
    reload,
    addSource,
    removeSource,
    setSourceEnabled,
    moveSource,
    clearAll,
    refresh,
    importFile,
    detect,
    mapChannel,
    unmapChannel,
  };
}

export type EpgManager = ReturnType<typeof useEpgManager>;
