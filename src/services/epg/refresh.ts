/**
 * Refresh orchestration: worker parse → atomic persistence. The old guide data
 * stays in place until the worker returns a complete parse, so a failed
 * download/parse never wipes the guide.
 */

import type { Channel, EpgSource } from '../../domain/types.ts';
import type { EpgParseProgress, EpgParserChannel, EpgRetentionWindow } from './parseXmltv.ts';
import { startEpgParse } from './workerClient.ts';
import { createDexieEpgRepository, type EpgRepository } from './repository.ts';

export function toParserChannels(channels: readonly Channel[]): EpgParserChannel[] {
  return channels.map((c) => ({
    id: c.id,
    name: c.name,
    tvgId: c.tvgId,
    tvgName: c.tvgName,
    tvgShift: c.tvgShift,
  }));
}

export interface RefreshEpgOptions {
  source: EpgSource;
  playlistId: string;
  channels: readonly Channel[];
  proxyTemplate?: string;
  repository?: EpgRepository;
  now?: number;
  timeoutMs?: number;
  retention?: EpgRetentionWindow;
  /** Pre-read local file contents (local import fallback). */
  text?: string;
  signal?: AbortSignal;
  onProgress?: (progress: EpgParseProgress) => void;
  createWorker?: () => Worker;
}

export interface RefreshEpgSummary {
  notModified: boolean;
  matched: number;
  unmatched: number;
  ambiguous: number;
  programmes: number;
  channels: number;
}

export async function refreshEpgSource(options: RefreshEpgOptions): Promise<RefreshEpgSummary> {
  const repository = options.repository ?? createDexieEpgRepository();
  const now = options.now ?? Date.now();
  const { source, playlistId } = options;
  const parserChannels = toParserChannels(options.channels);

  const handle = startEpgParse(
    {
      kind: options.text !== undefined ? 'text' : 'url',
      sourceId: source.id,
      url: source.url,
      text: options.text,
      proxyTemplate: options.proxyTemplate,
      etag: source.etag,
      lastModified: source.lastModified,
      timeoutMs: options.timeoutMs,
      channels: parserChannels,
      now,
      retention: options.retention,
    },
    { onProgress: options.onProgress, createWorker: options.createWorker }
  );

  const abortListener = () => handle.cancel();
  options.signal?.addEventListener('abort', abortListener, { once: true });

  try {
    const outcome = await handle.promise;
    if (outcome.notModified) {
      await repository.putSource({
        ...source,
        lastFetchedAt: now,
        etag: outcome.etag ?? source.etag,
        lastModified: outcome.lastModified ?? source.lastModified,
      });
      return { notModified: true, matched: 0, unmatched: 0, ambiguous: 0, programmes: 0, channels: 0 };
    }

    const result = outcome.result;
    await repository.replaceEpgChannels(
      source.id,
      result.channels.map((c) => ({
        id: `${source.id}::${c.id}`,
        sourceId: source.id,
        playlistId,
        xmltvId: c.id,
        displayNames: c.displayNames,
        icon: c.icon,
      }))
    );

    const existing = await repository.listMappings(playlistId);
    const existingByChannel = new Map(existing.map((m) => [m.channelId, m]));
    const matchedIds = new Set(result.matchReport.matched.map((m) => m.channelId));

    // Drop stale auto mappings for this source that no longer match.
    for (const mapping of existing) {
      if (mapping.manual || mapping.sourceId !== source.id) continue;
      if (!matchedIds.has(mapping.channelId)) await repository.deleteMapping(mapping.channelId);
    }

    let matched = 0;
    for (const match of result.matchReport.matched) {
      if (existingByChannel.get(match.channelId)?.manual) continue; // manual always wins
      await repository.putMapping({
        channelId: match.channelId,
        playlistId,
        sourceId: source.id,
        epgChannelId: `${source.id}::${match.xmltvId}`,
        xmltvId: match.xmltvId,
        method: match.method,
        confidence: match.confidence,
        manual: false,
        updatedAt: now,
      });
      matched++;
    }

    await repository.applyProgrammeImport(result.imports);
    await repository.pruneExpired(now);

    const channelCount = result.channels.length;
    const programmeCount = result.stats.programmesKept;
    await repository.putSource({
      ...source,
      lastFetchedAt: now,
      lastUpdatedAt: now,
      etag: outcome.etag ?? source.etag,
      lastModified: outcome.lastModified ?? source.lastModified,
      channelCount,
      programmeCount,
      matchRate: parserChannels.length > 0 ? matched / parserChannels.length : 0,
    });

    return {
      notModified: false,
      matched,
      unmatched: result.matchReport.unmatched.length,
      ambiguous: result.matchReport.ambiguous.length,
      programmes: programmeCount,
      channels: channelCount,
    };
  } finally {
    options.signal?.removeEventListener('abort', abortListener);
  }
}
