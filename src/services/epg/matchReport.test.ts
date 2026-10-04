import { describe, it, expect } from 'vitest';
import type { Channel, EpgChannel, EpgMapping } from '../../domain/types.ts';
import { buildEpgMatchReport } from './matchReport.ts';

function channel(id: string, name: string, tvgId?: string): Channel {
  return {
    id,
    playlistId: 'pl1',
    name,
    groupId: 'g',
    groupName: 'G',
    streamUrl: 'https://example.invalid/s.ts',
    tvgId,
  };
}

function epgChannel(id: string, xmltvId: string, displayNames: string[]): EpgChannel {
  return { id, sourceId: 'src1', playlistId: 'pl1', xmltvId, displayNames };
}

function mapping(channelId: string, xmltvId: string, manual: boolean): EpgMapping {
  return {
    channelId,
    playlistId: 'pl1',
    sourceId: 'src1',
    epgChannelId: `src1::${xmltvId}`,
    xmltvId,
    method: manual ? 'manual' : 'tvg-id',
    confidence: 1,
    manual,
    updatedAt: 1,
  };
}

describe('buildEpgMatchReport', () => {
  it('classifies matched, unmatched and ambiguous channels', () => {
    const channels = [channel('ch1', 'CNN', 'cnn'), channel('ch2', 'Mystery'), channel('ch3', 'News')];
    const epgChannels = [epgChannel('e1', 'cnn', ['CNN']), epgChannel('e2', 'n1', ['News']), epgChannel('e3', 'n2', ['News'])];

    const report = buildEpgMatchReport(channels, epgChannels, [mapping('ch1', 'cnn', false)]);

    expect(report.matched.map((m) => m.channelId)).toEqual(['ch1']);
    expect(report.unmatched.map((c) => c.id)).toEqual(['ch2']);
    expect(report.ambiguous.map((a) => a.channelId)).toEqual(['ch3']);
  });

  it('lets a manual mapping win over the matcher', () => {
    const channels = [channel('ch1', 'Totally Different')];
    const epgChannels = [epgChannel('e1', 'cnn', ['CNN'])];

    const report = buildEpgMatchReport(channels, epgChannels, [mapping('ch1', 'cnn', true)]);

    expect(report.matched).toEqual([
      { channelId: 'ch1', xmltvId: 'cnn', method: 'manual', confidence: 1 },
    ]);
    expect(report.unmatched).toHaveLength(0);
  });

  it('reports every channel as unmatched when there are no EPG channels', () => {
    const report = buildEpgMatchReport([channel('ch1', 'CNN', 'cnn')], [], []);
    expect(report.unmatched.map((c) => c.id)).toEqual(['ch1']);
    expect(report.total).toBe(1);
  });
});
