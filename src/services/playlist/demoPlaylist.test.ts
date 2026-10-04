import { describe, it, expect } from 'vitest';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { createStreamwalaDatabase, toggleChannelFavorite, addWatchHistory, getRecentWatchHistory } from '../storage/db.ts';
import { installDemoPlaylist } from './demoPlaylist.ts';

describe('demo playlist re-sync (BUG-017)', () => {
  it('preserves user favorite/hidden flags and history across a re-sync', async () => {
    const database = createStreamwalaDatabase(`StreamwalaDemoResync_${Date.now()}`, {
      indexedDB,
      IDBKeyRange,
    });

    await installDemoPlaylist(database);

    // ch_tears_of_steel is not a favorite in the shipped demo data.
    await toggleChannelFavorite('ch_tears_of_steel', database);
    await database.channels.update('ch_tears_of_steel', { isHidden: true });
    await addWatchHistory(
      { channelId: 'ch_tears_of_steel', name: 'Tears of Steel', streamUrl: 'https://example.com/tos.m3u8' },
      database
    );

    // Simulate an app-start re-sync of the demo playlist.
    await installDemoPlaylist(database);

    const channel = await database.channels.get('ch_tears_of_steel');
    expect(channel?.isFavorite).toBe(true);
    expect(channel?.isHidden).toBe(true);

    const history = await getRecentWatchHistory(20, database);
    expect(history.some((h) => h.channelId === 'ch_tears_of_steel')).toBe(true);

    await database.delete();
  });
});