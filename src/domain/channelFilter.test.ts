import { describe, it, expect } from 'vitest';
import { filterChannels, matchesChannelQuery } from './channelFilter.ts';
import type { Channel } from './types.ts';

function makeChannel(
  id: string,
  name: string,
  groupName: string,
  number: number | undefined = undefined
): Channel {
  return {
    id,
    playlistId: 'pl_test',
    name,
    groupId: `grp_${groupName}`,
    groupName,
    streamUrl: 'https://example.invalid/stream.m3u8',
    number,
    isFavorite: false,
    isHidden: false,
    isLocked: false,
  };
}

const CHANNELS: Channel[] = [
  makeChannel('c1', 'Alpha News', 'News', 1),
  makeChannel('c2', 'Beta Sports', 'Sports', 22),
  makeChannel('c3', 'Gamma Kids', 'Family', 103),
];

describe('filterChannels', () => {
  it('returns every channel for a blank query, in input order', () => {
    expect(filterChannels(CHANNELS, '').map((c) => c.id)).toEqual(['c1', 'c2', 'c3']);
    expect(filterChannels(CHANNELS, '   ').map((c) => c.id)).toEqual(['c1', 'c2', 'c3']);
  });

  it('matches the channel name case-insensitively', () => {
    expect(filterChannels(CHANNELS, 'alpha').map((c) => c.id)).toEqual(['c1']);
    expect(filterChannels(CHANNELS, 'ALPHA').map((c) => c.id)).toEqual(['c1']);
  });

  it('matches the group name', () => {
    expect(filterChannels(CHANNELS, 'sports').map((c) => c.id)).toEqual(['c2']);
    expect(filterChannels(CHANNELS, 'family').map((c) => c.id)).toEqual(['c3']);
  });

  it('matches a partial channel number', () => {
    expect(filterChannels(CHANNELS, '10').map((c) => c.id)).toEqual(['c3']);
    expect(filterChannels(CHANNELS, '2').map((c) => c.id)).toEqual(['c2']);
    expect(filterChannels(CHANNELS, '3').map((c) => c.id)).toEqual(['c3']);
  });

  it('preserves input order for multi-match queries', () => {
    expect(filterChannels(CHANNELS, 'a').map((c) => c.id)).toEqual(['c1', 'c2', 'c3']);
  });

  it('returns an empty list when nothing matches', () => {
    expect(filterChannels(CHANNELS, 'zzz')).toEqual([]);
  });

  it('never returns the source array itself', () => {
    const result = filterChannels(CHANNELS, '');
    expect(result).not.toBe(CHANNELS);
    expect(result).toEqual(CHANNELS);
  });
});

describe('matchesChannelQuery', () => {
  it('treats a blank query as a match', () => {
    expect(matchesChannelQuery(CHANNELS[0], '')).toBe(true);
  });

  it('ignores a missing channel number', () => {
    const channel = makeChannel('c4', 'No Number', 'Misc');
    expect(matchesChannelQuery(channel, '4')).toBe(false);
  });
});
