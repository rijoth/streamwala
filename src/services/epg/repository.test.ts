import { describe, it, expect } from 'vitest';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import type { EpgChannel, EpgMapping, EpgSource, Program } from '../../domain/types.ts';
import { createAetherDatabase, type AetherDatabase } from '../storage/db.ts';
import { createDexieEpgRepository } from './repository.ts';
import { createFakeEpgRepository } from './fakeRepository.ts';

let counter = 0;

function freshDatabase(): AetherDatabase {
  counter += 1;
  return createAetherDatabase(`EpgRepo_${Date.now()}_${counter}`, { indexedDB, IDBKeyRange });
}

function program(
  id: string,
  channelId: string,
  start: number,
  stop: number,
  sourceId?: string
): Program {
  return { id, channelId, start, stop, title: `P${id}`, sourceId };
}

function source(id: string, playlistId: string, priority = 0): EpgSource {
  return {
    id,
    playlistId,
    name: `Source ${id}`,
    kind: 'remote',
    enabled: true,
    priority,
    channelCount: 1,
    programmeCount: 1,
  };
}

function epgChannel(id: string, sourceId: string, playlistId: string): EpgChannel {
  return { id, sourceId, playlistId, xmltvId: id, displayNames: [id] };
}

function mapping(channelId: string, playlistId: string, sourceId: string): EpgMapping {
  return {
    channelId,
    playlistId,
    sourceId,
    epgChannelId: `${sourceId}::${channelId}`,
    xmltvId: channelId,
    method: 'name',
    confidence: 0.9,
    manual: false,
    updatedAt: 1,
  };
}

describe('fake repository', () => {
  it('swaps a channel programme set atomically', async () => {
    const repo = createFakeEpgRepository();
    await repo.applyProgrammeImport([
      { channelId: 'ch1', programs: [program('old', 'ch1', 0, 100)] },
    ]);
    await repo.applyProgrammeImport([
      { channelId: 'ch1', programs: [program('new', 'ch1', 200, 300)] },
    ]);

    expect(await repo.getPrograms('ch1', -1000, 1000)).toEqual([
      expect.objectContaining({ id: 'new' }),
    ]);
  });

  it('keeps the previous data when an import fails', async () => {
    const repo = createFakeEpgRepository();
    await repo.applyProgrammeImport([
      { channelId: 'ch1', programs: [program('old', 'ch1', 0, 100)] },
    ]);

    repo.failNextImport = new Error('parse failed');
    await expect(
      repo.applyProgrammeImport([{ channelId: 'ch1', programs: [program('new', 'ch1', 200, 300)] }])
    ).rejects.toThrow('parse failed');

    expect(await repo.getPrograms('ch1', -1000, 1000)).toEqual([
      expect.objectContaining({ id: 'old' }),
    ]);
  });

  it('prunes ended programmes but never the airing one', async () => {
    const repo = createFakeEpgRepository();
    const now = 1000;
    await repo.applyProgrammeImport([
      {
        channelId: 'ch1',
        programs: [
          program('ended', 'ch1', 0, 500),
          program('airing', 'ch1', 800, 1200),
          program('future', 'ch1', 2000, 3000),
        ],
      },
    ]);

    expect(await repo.pruneExpired(now)).toBe(1);
    const kept = await repo.getPrograms('ch1', -1000, 5000);
    expect(kept.map((p) => p.id)).toEqual(['airing', 'future']);
  });

  it('cascades a source delete', async () => {
    const repo = createFakeEpgRepository();
    await repo.putSource(source('src1', 'pl1'));
    await repo.putSource(source('src2', 'pl1'));
    await repo.replaceEpgChannels('src1', [epgChannel('a', 'src1', 'pl1')]);
    await repo.replaceEpgChannels('src2', [epgChannel('b', 'src2', 'pl1')]);
    await repo.putMapping(mapping('ch1', 'pl1', 'src1'));
    await repo.applyProgrammeImport([{ channelId: 'ch1', programs: [program('p1', 'ch1', 0, 100, 'src1')] }]);

    await repo.deleteSource('src1');

    expect(await repo.getSource('src1')).toBeUndefined();
    expect(await repo.getSource('src2')).toBeDefined();
    expect(await repo.listEpgChannels('src1')).toHaveLength(0);
    expect(await repo.listEpgChannels('src2')).toHaveLength(1);
    expect(await repo.getMapping('ch1')).toBeUndefined();
    expect(await repo.getPrograms('ch1', -1000, 1000)).toHaveLength(0);
  });
});

describe('dexie repository', () => {
  it('lists sources in priority order', async () => {
    const database = freshDatabase();
    const repo = createDexieEpgRepository(database);
    await repo.putSource(source('low', 'pl1', 5));
    await repo.putSource(source('high', 'pl1', 0));
    await repo.putSource(source('other', 'pl2', 1));

    expect((await repo.listSources('pl1')).map((s) => s.id)).toEqual(['high', 'low']);
    await database.delete();
  });

  it('replaces only the target source channels', async () => {
    const database = freshDatabase();
    const repo = createDexieEpgRepository(database);
    await repo.replaceEpgChannels('src1', [epgChannel('old', 'src1', 'pl1')]);
    await repo.replaceEpgChannels('src2', [epgChannel('keep', 'src2', 'pl1')]);

    await repo.replaceEpgChannels('src1', [epgChannel('new', 'src1', 'pl1')]);

    expect((await repo.listEpgChannels('src1')).map((c) => c.id)).toEqual(['new']);
    expect((await repo.listEpgChannels('src2')).map((c) => c.id)).toEqual(['keep']);
    await database.delete();
  });

  it('cascades a source delete across channels, mappings and programmes', async () => {
    const database = freshDatabase();
    const repo = createDexieEpgRepository(database);
    await repo.putSource(source('src1', 'pl1'));
    await repo.replaceEpgChannels('src1', [epgChannel('a', 'src1', 'pl1')]);
    await repo.putMapping(mapping('ch1', 'pl1', 'src1'));
    await repo.applyProgrammeImport([
      { channelId: 'ch1', programs: [program('p1', 'ch1', 0, 100, 'src1')] },
    ]);

    await repo.deleteSource('src1');

    expect(await repo.getSource('src1')).toBeUndefined();
    expect(await repo.listEpgChannels('src1')).toHaveLength(0);
    expect(await repo.getMapping('ch1')).toBeUndefined();
    expect(await database.programs.count()).toBe(0);
    await database.delete();
  });

  it('returns programmes overlapping a time window, sorted by start', async () => {
    const database = freshDatabase();
    const repo = createDexieEpgRepository(database);
    await repo.applyProgrammeImport([
      {
        channelId: 'ch1',
        programs: [
          program('overlap', 'ch1', 50, 150),
          program('edge', 'ch1', 200, 300),
          program('before', 'ch1', 10, 90),
          program('after', 'ch1', 400, 500),
          program('other', 'ch2', 100, 200),
        ],
      },
    ]);

    const rows = await repo.getPrograms('ch1', 100, 200);
    expect(rows.map((p) => p.id)).toEqual(['overlap', 'edge']);
    await database.delete();
  });

  it('prunes ended programmes but never the airing one', async () => {
    const database = freshDatabase();
    const repo = createDexieEpgRepository(database);
    await repo.applyProgrammeImport([
      {
        channelId: 'ch1',
        programs: [
          program('ended', 'ch1', 0, 500),
          program('airing', 'ch1', 800, 1200),
          program('future', 'ch1', 2000, 3000),
        ],
      },
    ]);

    expect(await repo.pruneExpired(1000)).toBe(1);
    expect((await repo.getPrograms('ch1', -1000, 5000)).map((p) => p.id)).toEqual([
      'airing',
      'future',
    ]);
    await database.delete();
  });

  it('keeps a manual mapping across a channel re-sync', async () => {
    const database = freshDatabase();
    const repo = createDexieEpgRepository(database);
    const manual: EpgMapping = { ...mapping('ch1', 'pl1', 'src1'), manual: true, method: 'manual' };
    await repo.putMapping(manual);

    // A re-sync rewrites the playlist's channels but never the mapping table.
    await database.channels.put({
      id: 'ch1',
      playlistId: 'pl1',
      name: 'Renamed',
      groupId: 'g',
      groupName: 'G',
      streamUrl: 'https://example.invalid/ch1.m3u8',
    });

    expect(await repo.getMapping('ch1')).toEqual(manual);
    await database.delete();
  });

  it('rejects an invalid source at the boundary', async () => {
    const database = freshDatabase();
    const repo = createDexieEpgRepository(database);
    const invalid = { ...source('bad', 'pl1'), kind: 'nope' } as unknown as EpgSource;
    await expect(repo.putSource(invalid)).rejects.toThrow();
    await database.delete();
  });
});
