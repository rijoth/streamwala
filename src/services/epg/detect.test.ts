import { describe, it, expect } from 'vitest';
import type { Playlist } from '../../domain/types.ts';
import { detectEpgSources, xtreamEpgUrl } from './detect.ts';
import { EpgFetchError } from './fetcher.ts';

function playlist(partial: Partial<Playlist>): Playlist {
  return {
    id: 'pl1',
    name: 'Playlist',
    type: 'm3u',
    createdAt: 0,
    lastSyncedAt: 0,
    channelCount: 0,
    isActive: true,
    ...partial,
  };
}

describe('xtreamEpgUrl', () => {
  it('derives xmltv.php from server + credentials', () => {
    const url = xtreamEpgUrl({
      serverUrl: 'http://example.invalid:8080/',
      username: 'alice',
      password: 'p@ss word',
    });
    expect(url).toBe('http://example.invalid:8080/xmltv.php?username=alice&password=p%40ss%20word');
  });

  it('adds a scheme when the server omits one', () => {
    expect(xtreamEpgUrl({ serverUrl: 'example.invalid', username: 'a', password: 'b' })).toBe(
      'http://example.invalid/xmltv.php?username=a&password=b'
    );
  });
});

describe('detectEpgSources', () => {
  it('offers the Xtream XMLTV URL without any fetch', async () => {
    const fetchImpl = (() => {
      throw new Error('should not fetch');
    }) as unknown as typeof fetch;
    const suggestions = await detectEpgSources(
      playlist({ type: 'xtream', xtream: { serverUrl: 'http://example.invalid', username: 'u', password: 'p' } }),
      { fetchImpl }
    );
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].kind).toBe('xtream');
    expect(suggestions[0].url).toContain('/xmltv.php');
  });

  it('reads EPG URLs from the M3U header', async () => {
    const fetchImpl = (async () =>
      new Response(
        '#EXTM3U url-tvg="https://epg.example.invalid/e.xml"\n#EXTINF:-1 tvg-id="x",X\nhttp://s/x.ts'
      )) as unknown as typeof fetch;
    const suggestions = await detectEpgSources(
      playlist({ url: 'https://example.invalid/pl.m3u' }),
      { fetchImpl }
    );
    expect(suggestions).toEqual([
      { url: 'https://epg.example.invalid/e.xml', kind: 'remote', label: 'From playlist header (url-tvg)' },
    ]);
  });

  it('classifies a CORS failure instead of throwing raw', async () => {
    const fetchImpl = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    const error = await detectEpgSources(playlist({ url: 'https://example.invalid/pl.m3u' }), {
      fetchImpl,
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(EpgFetchError);
    expect((error as EpgFetchError).kind).toBe('cors');
  });

  it('returns nothing for a playlist with no usable source', async () => {
    expect(await detectEpgSources(playlist({ type: 'demo' }))).toEqual([]);
  });
});
