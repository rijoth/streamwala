import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useChannelSearch } from './useChannelSearch.ts';
import type { Channel } from '../../domain/types.ts';

function makeChannel(id: string, name: string, groupName: string): Channel {
  return {
    id,
    playlistId: 'pl_test',
    name,
    groupId: `grp_${groupName}`,
    groupName,
    streamUrl: 'https://example.invalid/stream.m3u8',
    isFavorite: false,
    isHidden: false,
    isLocked: false,
  };
}

const CHANNELS: Channel[] = [
  makeChannel('c1', 'Alpha News', 'News'),
  makeChannel('c2', 'Beta Sports', 'Sports'),
];

describe('useChannelSearch', () => {
  it('starts idle and exposes the whole scope', () => {
    const { result } = renderHook(() => useChannelSearch(CHANNELS));
    expect(result.current.isSearching).toBe(false);
    expect(result.current.query).toBe('');
    expect(result.current.results).toEqual(CHANNELS);
  });

  it('recomputes results as the query changes', () => {
    const { result } = renderHook(() => useChannelSearch(CHANNELS));

    act(() => result.current.setQuery('beta'));
    expect(result.current.isSearching).toBe(true);
    expect(result.current.results.map((c) => c.id)).toEqual(['c2']);

    act(() => result.current.setQuery('news'));
    expect(result.current.results.map((c) => c.id)).toEqual(['c1']);

    act(() => result.current.setQuery('zzz'));
    expect(result.current.results).toEqual([]);
  });

  it('treats a whitespace-only query as not searching', () => {
    const { result } = renderHook(() => useChannelSearch(CHANNELS));
    act(() => result.current.setQuery('   '));
    expect(result.current.isSearching).toBe(false);
    expect(result.current.results).toEqual(CHANNELS);
  });

  it('clears back to the full scope', () => {
    const { result } = renderHook(() => useChannelSearch(CHANNELS));
    act(() => result.current.setQuery('alpha'));
    act(() => result.current.clear());
    expect(result.current.query).toBe('');
    expect(result.current.isSearching).toBe(false);
    expect(result.current.results).toEqual(CHANNELS);
  });

  it('re-runs the query when the scope changes', () => {
    const { result, rerender } = renderHook(({ channels }) => useChannelSearch(channels), {
      initialProps: { channels: CHANNELS },
    });

    act(() => result.current.setQuery('beta'));
    expect(result.current.results.map((c) => c.id)).toEqual(['c2']);

    rerender({ channels: [CHANNELS[0]] });
    expect(result.current.results).toEqual([]);
  });
});
