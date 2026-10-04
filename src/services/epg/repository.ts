import Dexie from 'dexie';
import type { EpgChannel, EpgMapping, EpgSource, ProgrammeImport, Program } from '../../domain/types.ts';
import { EpgChannelSchema, EpgMappingSchema, EpgSourceSchema } from '../../domain/schemas.ts';
import { db, type StreamwalaDatabase } from '../storage/db.ts';

export type { ProgrammeImport } from '../../domain/types.ts';

/**
 * All EPG persistence behind one interface so screens never touch Dexie and
 * tests can swap in {@link createFakeEpgRepository}. Queries are scoped to a
 * channel + time window; the full guide is never loaded into React state.
 */
export interface EpgRepository {
  listSources(playlistId: string): Promise<EpgSource[]>;
  getSource(sourceId: string): Promise<EpgSource | undefined>;
  putSource(source: EpgSource): Promise<void>;
  /** Cascades: source channels, mappings and its programmes. */
  deleteSource(sourceId: string): Promise<void>;

  listEpgChannels(sourceId: string): Promise<EpgChannel[]>;
  replaceEpgChannels(sourceId: string, channels: EpgChannel[]): Promise<void>;

  getMapping(channelId: string): Promise<EpgMapping | undefined>;
  listMappings(playlistId: string): Promise<EpgMapping[]>;
  putMapping(mapping: EpgMapping): Promise<void>;
  deleteMapping(channelId: string): Promise<void>;

  getPrograms(channelId: string, startFrom: number, endTo: number): Promise<Program[]>;
  getProgramsForChannels(
    channelIds: string[],
    startFrom: number,
    endTo: number
  ): Promise<Program[]>;
  /** Per-channel atomic swap: old rows stay until the new set is written. */
  applyProgrammeImport(imports: ProgrammeImport[]): Promise<void>;
  /** Deletes programmes that have ended; never touches the airing one. */
  pruneExpired(now: number): Promise<number>;
}

const BATCH_SIZE = 1000;

/**
 * Dexie-backed repository. Every write runs inside a short transaction and
 * never awaits a non-Dexie promise inside one.
 */
export function createDexieEpgRepository(database: StreamwalaDatabase = db): EpgRepository {
  return {
    async listSources(playlistId) {
      const sources = await database.epgSources.where({ playlistId }).toArray();
      return sources.sort((a, b) => a.priority - b.priority);
    },

    getSource(sourceId) {
      return database.epgSources.get(sourceId);
    },

    async putSource(source) {
      await database.epgSources.put(EpgSourceSchema.parse(source));
    },

    async deleteSource(sourceId) {
      await database.transaction(
        'rw',
        [database.epgSources, database.epgChannels, database.epgMappings, database.programs],
        async () => {
          await database.epgMappings.where({ sourceId }).delete();
          await database.programs.where('sourceId').equals(sourceId).delete();
          await database.epgChannels.where({ sourceId }).delete();
          await database.epgSources.delete(sourceId);
        }
      );
    },

    listEpgChannels(sourceId) {
      return database.epgChannels.where({ sourceId }).toArray();
    },

    async replaceEpgChannels(sourceId, channels) {
      await database.transaction('rw', database.epgChannels, async () => {
        await database.epgChannels.where({ sourceId }).delete();
        for (let i = 0; i < channels.length; i += BATCH_SIZE) {
          const batch = channels.slice(i, i + BATCH_SIZE).map((c) => EpgChannelSchema.parse(c));
          await database.epgChannels.bulkPut(batch);
        }
      });
    },

    getMapping(channelId) {
      return database.epgMappings.get(channelId);
    },

    listMappings(playlistId) {
      return database.epgMappings.where({ playlistId }).toArray();
    },

    async putMapping(mapping) {
      await database.epgMappings.put(EpgMappingSchema.parse(mapping));
    },

    deleteMapping(channelId) {
      return database.epgMappings.delete(channelId);
    },

    async getPrograms(channelId, startFrom, endTo) {
      // The compound `[channelId+start]` index keeps the rows sorted; the lower
      // bound is minKey so a programme that started before the window but is
      // still airing inside it is not dropped.
      const rows = await database.programs
        .where('[channelId+start]')
        .between([channelId, Dexie.minKey], [channelId, endTo], true, true)
        .toArray();
      return rows.filter((p) => p.stop >= startFrom);
    },

    async getProgramsForChannels(channelIds, startFrom, endTo) {
      if (channelIds.length === 0) return [];
      const rows = await database.programs
        .where('channelId')
        .anyOf(channelIds)
        .filter((p) => p.stop >= startFrom && p.start <= endTo)
        .toArray();
      return rows.sort((a, b) => a.start - b.start);
    },

    async applyProgrammeImport(imports) {
      for (const entry of imports) {
        if (entry.programs.length === 0) continue;
        await database.transaction('rw', database.programs, async () => {
          await database.programs.where('channelId').equals(entry.channelId).delete();
          for (let i = 0; i < entry.programs.length; i += BATCH_SIZE) {
            await database.programs.bulkPut(entry.programs.slice(i, i + BATCH_SIZE));
          }
        });
      }
    },

    async pruneExpired(now) {
      // `stop` is indexed. Ended programmes have stop < now, so a currently
      // airing programme (start <= now < stop) can never be selected here.
      const stale = await database.programs.where('stop').below(now).primaryKeys();
      if (stale.length === 0) return 0;
      await database.programs.bulkDelete(stale);
      return stale.length;
    },
  };
}
