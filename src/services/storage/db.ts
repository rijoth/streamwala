import Dexie, { Table, type DexieOptions } from 'dexie';
import { Playlist, Channel, Group, Program, HistoryEntry } from '../../domain/types.ts';

export class AetherDatabase extends Dexie {
  playlists!: Table<Playlist, string>;
  channels!: Table<Channel, string>;
  groups!: Table<Group, string>;
  programs!: Table<Program, string>;
  history!: Table<HistoryEntry, string>;

  constructor(name = 'AetherIptvDatabase', options?: DexieOptions) {
    super(name, options);
    this.version(1).stores({
      playlists: 'id, type, name, lastSyncedAt, isActive',
      channels: 'id, playlistId, groupId, groupName, name, streamUrl, tvgId, isFavorite, isHidden, isLocked, [playlistId+groupId]',
      groups: 'id, playlistId, type, name',
      programs: 'id, channelId, tvgId, start, stop, [channelId+start]',
      history: 'id, channelId, watchedAt',
    });
  }
}

/**
 * Creates a database handle. Tests pass fake-indexeddb's `indexedDB` /
 * `IDBKeyRange` and a unique name to get an isolated, fresh database per test.
 *
 * IMPORTANT: any schema change must add a new `.version(n).stores(...)` with an
 * `.upgrade()` function and a migration test (see AGENTS.md and
 * docs/GUARDRAILS.md). Never mutate the v1 stores in place.
 */
export function createAetherDatabase(name = 'AetherIptvDatabase', options?: DexieOptions): AetherDatabase {
  return new AetherDatabase(name, options);
}

export const db = createAetherDatabase();

// Repository functions. Each takes an optional database handle so they can be
// pointed at an isolated test database; production callers use the singleton.
export async function getActivePlaylist(database: AetherDatabase = db): Promise<Playlist | undefined> {
  const active = await database.playlists.filter(p => p.isActive).first();
  if (active) return active;
  return await database.playlists.orderBy('lastSyncedAt').reverse().first();
}

export async function getAllPlaylists(database: AetherDatabase = db): Promise<Playlist[]> {
  return await database.playlists.toArray();
}

export async function savePlaylist(playlist: Playlist, database: AetherDatabase = db): Promise<void> {
  await database.transaction('rw', database.playlists, async () => {
    // If setting to active, deactivate other playlists
    if (playlist.isActive) {
      await database.playlists.toCollection().modify({ isActive: false });
    }
    await database.playlists.put(playlist);
  });
}

export async function deletePlaylist(playlistId: string, database: AetherDatabase = db): Promise<void> {
  await database.transaction('rw', [database.playlists, database.channels, database.groups, database.programs, database.history], async () => {
    const channelIds = await database.channels.where({ playlistId }).primaryKeys();

    await database.playlists.delete(playlistId);
    await database.channels.where({ playlistId }).delete();
    await database.groups.where({ playlistId }).delete();

    // Programs and watch history are keyed by channelId, so they must be
    // cascaded explicitly or they leak as orphans after a playlist delete.
    if (channelIds.length > 0) {
      await database.programs.where('channelId').anyOf(channelIds).delete();
      await database.history.where('channelId').anyOf(channelIds).delete();
    }
  });
}

export async function getGroupsForPlaylist(playlistId: string, database: AetherDatabase = db): Promise<Group[]> {
  return await database.groups.where({ playlistId }).toArray();
}

export async function getChannelsByGroup(playlistId: string, groupId?: string, search?: string, database: AetherDatabase = db): Promise<Channel[]> {
  const collection = database.channels.where({ playlistId });

  let results = await collection.toArray();

  if (groupId && groupId !== 'all' && groupId !== 'favorites') {
    results = results.filter(ch => ch.groupId === groupId);
  } else if (groupId === 'favorites') {
    results = results.filter(ch => ch.isFavorite);
  }

  if (search && search.trim()) {
    const q = search.toLowerCase().trim();
    results = results.filter(ch => ch.name.toLowerCase().includes(q) || (ch.groupName && ch.groupName.toLowerCase().includes(q)));
  }

  return results.filter(ch => !ch.isHidden);
}

export async function toggleChannelFavorite(channelId: string, database: AetherDatabase = db): Promise<boolean> {
  const channel = await database.channels.get(channelId);
  if (!channel) return false;

  const nextState = !channel.isFavorite;
  await database.channels.update(channelId, { isFavorite: nextState });
  return nextState;
}

export async function getProgramsForChannel(channelId: string, startFrom: number, endTo: number, database: AetherDatabase = db): Promise<Program[]> {
  return await database.programs
    .where('channelId')
    .equals(channelId)
    .filter(p => p.stop >= startFrom && p.start <= endTo)
    .sortBy('start');
}

export async function addWatchHistory(entry: Omit<HistoryEntry, 'id' | 'watchedAt'>, database: AetherDatabase = db): Promise<void> {
  const existing = await database.history.where('channelId').equals(entry.channelId).first();
  const id = existing ? existing.id : `hist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  await database.history.put({
    ...entry,
    id,
    watchedAt: Date.now(),
  });
}

export async function getRecentWatchHistory(limit = 20, database: AetherDatabase = db): Promise<HistoryEntry[]> {
  return await database.history.orderBy('watchedAt').reverse().limit(limit).toArray();
}

/**
 * Maps IDB/private-mode failures to a message that is safe to show in the UI.
 * Returns null for unknown errors so callers can fall back to err.message.
 */
export function toUserStorageMessage(error: unknown): string | null {
  if (!(error instanceof Error)) return null;
  if (error.name === 'QuotaExceededError' || /quota/i.test(error.message)) {
    return 'Device storage is full. Free up space or clear playlists from Settings, then try again.';
  }
  if (error.name === 'SecurityError' || /denied|blocked|private|readonly/i.test(error.message)) {
    return 'Local storage is unavailable (private browsing or blocked). Allow site data storage and try again.';
  }
  return null;
}