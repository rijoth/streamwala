import type { EpgChannel, EpgMapping, EpgSource, Program } from '../../domain/types.ts';
import type { EpgRepository } from './repository.ts';

/**
 * In-memory {@link EpgRepository} for tests (and non-Dexie environments).
 * Mirrors the Dexie semantics: per-channel atomic swap, source cascade, and
 * pruning that never removes the airing programme.
 */
export interface FakeEpgRepository extends EpgRepository {
  readonly sources: Map<string, EpgSource>;
  readonly epgChannels: Map<string, EpgChannel>;
  readonly mappings: Map<string, EpgMapping>;
  readonly programs: Map<string, Program>;
  /** When set, the next `applyProgrammeImport` throws before mutating. */
  failNextImport: Error | null;
}

export function createFakeEpgRepository(): FakeEpgRepository {
  const sources = new Map<string, EpgSource>();
  const epgChannels = new Map<string, EpgChannel>();
  const mappings = new Map<string, EpgMapping>();
  const programs = new Map<string, Program>();
  let failNextImport: Error | null = null;

  return {
    sources,
    epgChannels,
    mappings,
    programs,
    get failNextImport() {
      return failNextImport;
    },
    set failNextImport(error: Error | null) {
      failNextImport = error;
    },

    async listSources(playlistId) {
      return [...sources.values()]
        .filter((s) => s.playlistId === playlistId)
        .sort((a, b) => a.priority - b.priority);
    },
    async getSource(sourceId) {
      return sources.get(sourceId);
    },
    async putSource(source) {
      sources.set(source.id, { ...source });
    },
    async deleteSource(sourceId) {
      for (const [id, mapping] of mappings) {
        if (mapping.sourceId === sourceId) mappings.delete(id);
      }
      for (const [id, program] of programs) {
        if (program.sourceId === sourceId) programs.delete(id);
      }
      for (const [id, channel] of epgChannels) {
        if (channel.sourceId === sourceId) epgChannels.delete(id);
      }
      sources.delete(sourceId);
    },

    async listEpgChannels(sourceId) {
      return [...epgChannels.values()].filter((c) => c.sourceId === sourceId);
    },
    async replaceEpgChannels(sourceId, channels) {
      for (const [id, channel] of epgChannels) {
        if (channel.sourceId === sourceId) epgChannels.delete(id);
      }
      for (const channel of channels) epgChannels.set(channel.id, { ...channel });
    },

    async getMapping(channelId) {
      return mappings.get(channelId);
    },
    async listMappings(playlistId) {
      return [...mappings.values()].filter((m) => m.playlistId === playlistId);
    },
    async putMapping(mapping) {
      mappings.set(mapping.channelId, { ...mapping });
    },
    async deleteMapping(channelId) {
      mappings.delete(channelId);
    },

    async getPrograms(channelId, startFrom, endTo) {
      return [...programs.values()]
        .filter((p) => p.channelId === channelId && p.stop >= startFrom && p.start <= endTo)
        .sort((a, b) => a.start - b.start);
    },
    async getProgramsForChannels(channelIds, startFrom, endTo) {
      const wanted = new Set(channelIds);
      return [...programs.values()]
        .filter((p) => wanted.has(p.channelId) && p.stop >= startFrom && p.start <= endTo)
        .sort((a, b) => a.start - b.start);
    },
    async applyProgrammeImport(imports) {
      if (failNextImport) {
        const error = failNextImport;
        failNextImport = null;
        throw error;
      }
      for (const entry of imports) {
        for (const [id, program] of programs) {
          if (program.channelId === entry.channelId) programs.delete(id);
        }
        for (const program of entry.programs) programs.set(program.id, { ...program });
      }
    },
    async pruneExpired(now) {
      let removed = 0;
      for (const [id, program] of programs) {
        if (program.stop < now) {
          programs.delete(id);
          removed++;
        }
      }
      return removed;
    },
  };
}
