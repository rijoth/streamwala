import { describe, it, expect } from 'vitest';
import Dexie from 'dexie';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { createAetherDatabase, deletePlaylist, getProgramsForChannel, toUserStorageMessage, type AetherDatabase } from './db.ts';
import type { Playlist, Channel, Group, Program, HistoryEntry, EpgSource, EpgChannel, EpgMapping } from '../../domain/types.ts';

let counter = 0;

function freshDatabase(): AetherDatabase {
  counter += 1;
  return createAetherDatabase(`AetherTest_${Date.now()}_${counter}`, { indexedDB, IDBKeyRange });
}

function makePlaylist(id: string, name: string): Playlist {
  return {
    id,
    name,
    type: 'm3u',
    createdAt: 1,
    lastSyncedAt: 1,
    channelCount: 1,
    isActive: false,
  };
}

function makeChannel(id: string, playlistId: string, isFavorite = false): Channel {
  return {
    id,
    playlistId,
    name: `Channel ${id}`,
    groupId: `grp_${playlistId}`,
    groupName: 'Group',
    streamUrl: `https://example.com/${id}.m3u8`,
    isFavorite,
    isHidden: false,
    isLocked: false,
  };
}

function makeGroup(id: string, playlistId: string): Group {
  return { id, playlistId, name: 'Group', type: 'live', channelCount: 1 };
}

function makeProgram(id: string, channelId: string): Program {
  return { id, channelId, start: 0, stop: 1000, title: 'Programme' };
}

function makeSource(id: string, playlistId: string): EpgSource {
  return {
    id,
    playlistId,
    name: `Source ${id}`,
    kind: 'remote',
    enabled: true,
    priority: 0,
    channelCount: 1,
    programmeCount: 1,
  };
}

function makeEpgChannel(id: string, sourceId: string, playlistId: string): EpgChannel {
  return { id, sourceId, playlistId, xmltvId: id, displayNames: [id] };
}

function makeMapping(
  channelId: string,
  playlistId: string,
  sourceId: string,
  epgChannelId: string
): EpgMapping {
  return {
    channelId,
    playlistId,
    sourceId,
    epgChannelId,
    xmltvId: epgChannelId,
    method: 'tvg-id',
    confidence: 1,
    manual: false,
    updatedAt: 1,
  };
}

describe('storage cascade + schema (BUG-004 proof)', () => {
  it('deleting a playlist leaves zero orphans across all tables', async () => {
    const database = freshDatabase();

    const p1 = makePlaylist('pl_1', 'One');
    const p2 = makePlaylist('pl_2', 'Two');
    const ch1 = makeChannel('ch_1', p1.id, true);
    const ch2 = makeChannel('ch_2', p1.id);
    const chOther = makeChannel('ch_other', p2.id);
    const grp1 = makeGroup('grp_1', p1.id);
    const grpOther = makeGroup('grp_other', p2.id);
    const prog1 = makeProgram('prog_1', ch1.id);
    const progOther = makeProgram('prog_other', chOther.id);
    const history: HistoryEntry = {
      id: 'hist_1',
      channelId: ch1.id,
      name: 'Channel ch_1',
      streamUrl: 'https://example.com/ch_1.m3u8',
      watchedAt: 1,
    };

    const src1 = makeSource('src_1', p1.id);
    const src2 = makeSource('src_2', p2.id);
    const epgCh1 = makeEpgChannel('epgch_1', src1.id, p1.id);
    const epgChOther = makeEpgChannel('epgch_other', src2.id, p2.id);
    const map1 = makeMapping(ch1.id, p1.id, src1.id, epgCh1.id);
    const mapOther = makeMapping(chOther.id, p2.id, src2.id, epgChOther.id);

    await database.playlists.bulkPut([p1, p2]);
    await database.channels.bulkPut([ch1, ch2, chOther]);
    await database.groups.bulkPut([grp1, grpOther]);
    await database.programs.bulkPut([prog1, progOther]);
    await database.history.bulkPut([history]);
    await database.epgSources.bulkPut([src1, src2]);
    await database.epgChannels.bulkPut([epgCh1, epgChOther]);
    await database.epgMappings.bulkPut([map1, mapOther]);

    await deletePlaylist(p1.id, database);

    expect(await database.playlists.get(p1.id)).toBeUndefined();
    expect(await database.channels.where({ playlistId: p1.id }).count()).toBe(0);
    expect(await database.groups.where({ playlistId: p1.id }).count()).toBe(0);
    expect(await database.programs.where('channelId').anyOf([ch1.id, ch2.id]).count()).toBe(0);
    expect(await database.history.where('channelId').anyOf([ch1.id, ch2.id]).count()).toBe(0);
    expect(await database.epgSources.where({ playlistId: p1.id }).count()).toBe(0);
    expect(await database.epgChannels.where({ playlistId: p1.id }).count()).toBe(0);
    expect(await database.epgMappings.where({ playlistId: p1.id }).count()).toBe(0);

    // The unrelated playlist must be untouched.
    expect(await database.channels.get(chOther.id)).toBeDefined();
    expect(await database.groups.get(grpOther.id)).toBeDefined();
    expect(await database.programs.get(progOther.id)).toBeDefined();
    expect(await database.epgSources.get(src2.id)).toBeDefined();
    expect(await database.epgChannels.get(epgChOther.id)).toBeDefined();
    expect(await database.epgMappings.get(chOther.id)).toBeDefined();

    await database.delete();
  });

  it('reopening the current schema preserves data and queries work', async () => {
    const name = `AetherReopen_${Date.now()}_${(counter += 1)}`;

    const first = createAetherDatabase(name, { indexedDB, IDBKeyRange });
    const playlist = makePlaylist('pl_reopen', 'Reopen');
    const channel = makeChannel('ch_reopen', playlist.id);
    const program = makeProgram('prog_reopen', channel.id);
    const source = makeSource('src_reopen', playlist.id);
    const epgChannel = makeEpgChannel('epgch_reopen', source.id, playlist.id);
    const mapping = makeMapping(channel.id, playlist.id, source.id, epgChannel.id);

    await first.playlists.put(playlist);
    await first.channels.put(channel);
    await first.programs.put(program);
    await first.epgSources.put(source);
    await first.epgChannels.put(epgChannel);
    await first.epgMappings.put(mapping);
    first.close();

    // Schema v2 exists today; this guards against a future in-place store
    // mutation or a broken upgrade path wiping existing data.
    const second = createAetherDatabase(name, { indexedDB, IDBKeyRange });
    expect(await second.playlists.get(playlist.id)).toEqual(playlist);
    expect(await second.channels.where({ playlistId: playlist.id }).count()).toBe(1);
    expect(await getProgramsForChannel(channel.id, -1, 2000, second)).toHaveLength(1);
    expect(await second.epgSources.get(source.id)).toEqual(source);
    expect(await second.epgChannels.get(epgChannel.id)).toEqual(epgChannel);
    expect(await second.epgMappings.get(channel.id)).toEqual(mapping);

    await second.delete();
  });

  it('migrates a v1 database to v2 without losing rows', async () => {
    const name = `AetherMigrate_${Date.now()}_${(counter += 1)}`;

    // Build a genuine v1 database on disk, then open it with the v2 class.
    const legacy = new Dexie(name, { indexedDB, IDBKeyRange });
    legacy.version(1).stores({
      playlists: 'id, type, name, lastSyncedAt, isActive',
      channels: 'id, playlistId, groupId, groupName, name, streamUrl, tvgId, isFavorite, isHidden, isLocked, [playlistId+groupId]',
      groups: 'id, playlistId, type, name',
      programs: 'id, channelId, tvgId, start, stop, [channelId+start]',
      history: 'id, channelId, watchedAt',
    });
    await legacy.open();
    await legacy.table('playlists').put(makePlaylist('pl_mig', 'Migrated'));
    await legacy.table('channels').put(makeChannel('ch_mig', 'pl_mig'));
    await legacy.table('programs').put(makeProgram('prog_mig', 'ch_mig'));
    legacy.close();

    const upgraded = createAetherDatabase(name, { indexedDB, IDBKeyRange });
    expect(await upgraded.playlists.get('pl_mig')).toBeDefined();
    expect(await upgraded.channels.get('ch_mig')).toBeDefined();
    expect(await upgraded.programs.get('prog_mig')).toBeDefined();

    // The v2 tables exist and accept rows, and the new programs index works.
    const tableNames = upgraded.tables.map((t) => t.name);
    expect(tableNames).toEqual(expect.arrayContaining(['epgSources', 'epgChannels', 'epgMappings']));
    await upgraded.epgSources.put(makeSource('src_mig', 'pl_mig'));
    expect(await upgraded.epgSources.get('src_mig')).toBeDefined();
    expect(await upgraded.programs.where('sourceId').equals('missing').count()).toBe(0);

    await upgraded.delete();
  });
});

describe('toUserStorageMessage (BUG-016)', () => {
  function namedError(name: string, message: string): Error {
    const err = new Error(message);
    err.name = name;
    return err;
  }

  it('maps quota-exceeded failures to actionable copy', () => {
    expect(toUserStorageMessage(namedError('QuotaExceededError', 'quota exceeded'))).toMatch(
      /storage is full/i
    );
  });

  it('maps blocked/private-mode storage failures to actionable copy', () => {
    expect(toUserStorageMessage(namedError('SecurityError', 'access denied'))).toMatch(
      /storage is unavailable/i
    );
  });

  it('returns null for unknown errors so callers keep the raw message', () => {
    expect(toUserStorageMessage(new Error('boom'))).toBeNull();
    expect(toUserStorageMessage('not an error')).toBeNull();
  });
});