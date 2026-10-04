import { describe, it, expect } from 'vitest';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { createAetherDatabase, deletePlaylist, getProgramsForChannel, type AetherDatabase } from './db.ts';
import type { Playlist, Channel, Group, Program, HistoryEntry } from '../../domain/types.ts';

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

    await database.playlists.bulkPut([p1, p2]);
    await database.channels.bulkPut([ch1, ch2, chOther]);
    await database.groups.bulkPut([grp1, grpOther]);
    await database.programs.bulkPut([prog1, progOther]);
    await database.history.bulkPut([history]);

    await deletePlaylist(p1.id, database);

    expect(await database.playlists.get(p1.id)).toBeUndefined();
    expect(await database.channels.where({ playlistId: p1.id }).count()).toBe(0);
    expect(await database.groups.where({ playlistId: p1.id }).count()).toBe(0);
    expect(await database.programs.where('channelId').anyOf([ch1.id, ch2.id]).count()).toBe(0);
    expect(await database.history.where('channelId').anyOf([ch1.id, ch2.id]).count()).toBe(0);

    // The unrelated playlist must be untouched.
    expect(await database.channels.get(chOther.id)).toBeDefined();
    expect(await database.groups.get(grpOther.id)).toBeDefined();
    expect(await database.programs.get(progOther.id)).toBeDefined();

    await database.delete();
  });

  it('reopening the current schema preserves data and queries work', async () => {
    const name = `AetherReopen_${Date.now()}_${(counter += 1)}`;

    const first = createAetherDatabase(name, { indexedDB, IDBKeyRange });
    const playlist = makePlaylist('pl_reopen', 'Reopen');
    const channel = makeChannel('ch_reopen', playlist.id);
    const program = makeProgram('prog_reopen', channel.id);

    await first.playlists.put(playlist);
    await first.channels.put(channel);
    await first.programs.put(program);
    first.close();

    // Only schema v1 exists today; this guards against a future in-place store
    // mutation or a broken upgrade path wiping existing data.
    const second = createAetherDatabase(name, { indexedDB, IDBKeyRange });
    expect(await second.playlists.get(playlist.id)).toEqual(playlist);
    expect(await second.channels.where({ playlistId: playlist.id }).count()).toBe(1);
    expect(await getProgramsForChannel(channel.id, -1, 2000, second)).toHaveLength(1);

    await second.delete();
  });
});