import { describe, it, expect, vi } from 'vitest';
import type { Channel, EpgSource } from '../../domain/types.ts';
import type { EpgParseResult } from './parseXmltv.ts';
import type { EpgWorkerMessage } from './workerProtocol.ts';
import { refreshEpgSource } from './refresh.ts';
import { createFakeEpgRepository } from './fakeRepository.ts';

class DoneWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  terminate = vi.fn();
  postMessage = vi.fn();

  constructor(message: EpgWorkerMessage) {
    queueMicrotask(() => this.onmessage?.({ data: message } as MessageEvent));
  }
}

const CHANNEL: Channel = {
  id: 'ch1',
  playlistId: 'pl1',
  name: 'CNN',
  groupId: 'g',
  groupName: 'G',
  streamUrl: 'https://example.invalid/s.ts',
  tvgId: 'cnn',
};

function source(): EpgSource {
  return {
    id: 'src1',
    playlistId: 'pl1',
    name: 'Guide',
    url: 'https://example.invalid/epg.xml',
    kind: 'remote',
    enabled: true,
    priority: 0,
    channelCount: 0,
    programmeCount: 0,
  };
}

function resultWithMatch(): EpgParseResult {
  return {
    channels: [{ id: 'cnn', displayNames: ['CNN'] }],
    matchReport: {
      matched: [{ channelId: 'ch1', xmltvId: 'cnn', method: 'tvg-id', confidence: 1 }],
      unmatched: [],
      ambiguous: [],
    },
    imports: [
      {
        channelId: 'ch1',
        programs: [
          { id: 'prog_ch1_0', channelId: 'ch1', start: 0, stop: 100, title: 'T', sourceId: 'src1' },
        ],
      },
    ],
    stats: { bytes: 100, channels: 1, programmesKept: 1, programmesSkipped: 0, badDates: 0, errors: 0 },
  };
}

function emptyResult(): EpgParseResult {
  return {
    channels: [],
    matchReport: { matched: [], unmatched: [], ambiguous: [] },
    imports: [],
    stats: { bytes: 0, channels: 0, programmesKept: 0, programmesSkipped: 0, badDates: 0, errors: 0 },
  };
}

describe('refreshEpgSource', () => {
  it('persists channels, mappings, programmes and source stats', async () => {
    const repository = createFakeEpgRepository();
    const worker = new DoneWorker({
      type: 'done',
      result: resultWithMatch(),
      notModified: false,
      etag: 'W/"2"',
    });

    const summary = await refreshEpgSource({
      source: source(),
      playlistId: 'pl1',
      channels: [CHANNEL],
      repository,
      now: 50,
      createWorker: () => worker as unknown as Worker,
    });

    expect(summary).toMatchObject({ notModified: false, matched: 1, programmes: 1, channels: 1 });
    expect(await repository.listEpgChannels('src1')).toHaveLength(1);
    expect(await repository.getMapping('ch1')).toMatchObject({ xmltvId: 'cnn', manual: false });
    expect(await repository.getPrograms('ch1', -1, 1000)).toHaveLength(1);
    expect(await repository.getSource('src1')).toMatchObject({
      lastUpdatedAt: 50,
      programmeCount: 1,
      matchRate: 1,
      etag: 'W/"2"',
    });
  });

  it('keeps a manual mapping when the auto matcher agrees', async () => {
    const repository = createFakeEpgRepository();
    await repository.putMapping({
      channelId: 'ch1',
      playlistId: 'pl1',
      sourceId: 'src1',
      epgChannelId: 'src1::cnn',
      xmltvId: 'cnn',
      method: 'manual',
      confidence: 1,
      manual: true,
      updatedAt: 1,
    });
    const worker = new DoneWorker({ type: 'done', result: resultWithMatch(), notModified: false });

    await refreshEpgSource({
      source: source(),
      playlistId: 'pl1',
      channels: [CHANNEL],
      repository,
      createWorker: () => worker as unknown as Worker,
    });

    expect(await repository.getMapping('ch1')).toMatchObject({ manual: true, method: 'manual' });
  });

  it('drops a stale auto mapping but keeps manual ones', async () => {
    const repository = createFakeEpgRepository();
    await repository.putMapping({
      channelId: 'ch1',
      playlistId: 'pl1',
      sourceId: 'src1',
      epgChannelId: 'src1::old',
      xmltvId: 'old',
      method: 'name',
      confidence: 0.9,
      manual: false,
      updatedAt: 1,
    });
    const worker = new DoneWorker({ type: 'done', result: emptyResult(), notModified: false });

    await refreshEpgSource({
      source: source(),
      playlistId: 'pl1',
      channels: [CHANNEL],
      repository,
      createWorker: () => worker as unknown as Worker,
    });

    expect(await repository.getMapping('ch1')).toBeUndefined();
  });

  it('only refreshes validators on a 304', async () => {
    const repository = createFakeEpgRepository();
    const worker = new DoneWorker({
      type: 'done',
      result: emptyResult(),
      notModified: true,
      etag: 'W/"9"',
    });

    const summary = await refreshEpgSource({
      source: source(),
      playlistId: 'pl1',
      channels: [CHANNEL],
      repository,
      now: 7000,
      createWorker: () => worker as unknown as Worker,
    });

    expect(summary.notModified).toBe(true);
    expect(await repository.getSource('src1')).toMatchObject({ etag: 'W/"9"', lastFetchedAt: 7000 });
    expect(await repository.listEpgChannels('src1')).toHaveLength(0);
  });
});
