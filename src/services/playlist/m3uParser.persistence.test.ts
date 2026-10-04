import { describe, it, expect } from 'vitest';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { createAetherDatabase } from '../storage/db.ts';
import { parseAndSaveM3U } from './m3uParser.ts';

const M3U = [
  '#EXTM3U',
  '#EXTINF:-1 tvg-id="a" group-title="News",Alpha',
  'https://example.com/a.m3u8',
  '#EXTINF:-1 group-title="News",Beta',
  'https://example.com/b.m3u8',
  '#EXTINF:-1 group-title="Sports",Gamma',
  'https://example.com/c.m3u8',
].join('\n');

describe('parseAndSaveM3U persistence atomicity', () => {
  it('rolls back all writes when a batch fails mid-import', async () => {
    const database = createAetherDatabase(`AetherAtomic_${Date.now()}`, { indexedDB, IDBKeyRange });

    const originalBulkPut = database.channels.bulkPut.bind(database.channels);
    let calls = 0;
    database.channels.bulkPut = ((items: Parameters<typeof originalBulkPut>[0]) => {
      calls += 1;
      if (calls === 2) {
        return Promise.reject(new Error('disk full mid-import'));
      }
      return originalBulkPut(items);
    }) as typeof database.channels.bulkPut;

    await expect(
      parseAndSaveM3U(M3U, { playlistId: 'pl_atomic', batchSize: 1, database })
    ).rejects.toThrow('disk full mid-import');

    // A failed import must leave no partial channels or groups behind.
    expect(await database.channels.count()).toBe(0);
    expect(await database.groups.count()).toBe(0);

    database.channels.bulkPut = originalBulkPut as typeof database.channels.bulkPut;
    await database.delete();
  });
});