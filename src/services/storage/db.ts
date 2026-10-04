import Dexie, { Table } from 'dexie';
import { Playlist, Channel, Group, Program, HistoryEntry } from '../../domain/types.ts';

export class AetherDatabase extends Dexie {
  playlists!: Table<Playlist, string>;
  channels!: Table<Channel, string>;
  groups!: Table<Group, string>;
  programs!: Table<Program, string>;
  history!: Table<HistoryEntry, string>;

  constructor() {
    super('AetherIptvDatabase');
    this.version(1).stores({
      playlists: 'id, type, name, lastSyncedAt, isActive',
      channels: 'id, playlistId, groupId, groupName, name, streamUrl, tvgId, isFavorite, isHidden, isLocked, [playlistId+groupId]',
      groups: 'id, playlistId, type, name',
      programs: 'id, channelId, tvgId, start, stop, [channelId+start]',
      history: 'id, channelId, watchedAt',
    });
  }
}

export const db = new AetherDatabase();

// Repository functions
export async function getActivePlaylist(): Promise<Playlist | undefined> {
  const active = await db.playlists.filter(p => p.isActive).first();
  if (active) return active;
  return await db.playlists.orderBy('lastSyncedAt').reverse().first();
}

export async function getAllPlaylists(): Promise<Playlist[]> {
  return await db.playlists.toArray();
}

export async function savePlaylist(playlist: Playlist): Promise<void> {
  await db.transaction('rw', db.playlists, async () => {
    // If setting to active, deactivate other playlists
    if (playlist.isActive) {
      await db.playlists.toCollection().modify({ isActive: false });
    }
    await db.playlists.put(playlist);
  });
}

export async function deletePlaylist(playlistId: string): Promise<void> {
  await db.transaction('rw', [db.playlists, db.channels, db.groups, db.programs], async () => {
    await db.playlists.delete(playlistId);
    await db.channels.where({ playlistId }).delete();
    await db.groups.where({ playlistId }).delete();
  });
}

export async function getGroupsForPlaylist(playlistId: string): Promise<Group[]> {
  return await db.groups.where({ playlistId }).toArray();
}

export async function getChannelsByGroup(playlistId: string, groupId?: string, search?: string): Promise<Channel[]> {
  let collection = db.channels.where({ playlistId });
  
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

export async function toggleChannelFavorite(channelId: string): Promise<boolean> {
  const channel = await db.channels.get(channelId);
  if (!channel) return false;

  const nextState = !channel.isFavorite;
  await db.channels.update(channelId, { isFavorite: nextState });
  return nextState;
}

export async function getProgramsForChannel(channelId: string, startFrom: number, endTo: number): Promise<Program[]> {
  return await db.programs
    .where('channelId')
    .equals(channelId)
    .filter(p => p.stop >= startFrom && p.start <= endTo)
    .sortBy('start');
}

export async function addWatchHistory(entry: Omit<HistoryEntry, 'id' | 'watchedAt'>): Promise<void> {
  const existing = await db.history.where('channelId').equals(entry.channelId).first();
  const id = existing ? existing.id : `hist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  await db.history.put({
    ...entry,
    id,
    watchedAt: Date.now(),
  });
}

export async function getRecentWatchHistory(limit = 20): Promise<HistoryEntry[]> {
  return await db.history.orderBy('watchedAt').reverse().limit(limit).toArray();
}
