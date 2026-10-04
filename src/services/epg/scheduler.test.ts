import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { EpgSource } from '../../domain/types.ts';
import { createFakeEpgRepository } from './fakeRepository.ts';
import { createEpgScheduler, type EpgScheduleStatus } from './scheduler.ts';

function source(id: string, lastUpdatedAt?: number): EpgSource {
  return {
    id,
    playlistId: 'pl1',
    name: id,
    kind: 'remote',
    enabled: true,
    priority: 0,
    channelCount: 0,
    programmeCount: 0,
    lastUpdatedAt,
  };
}

const HOUR = 3_600_000;

describe('createEpgScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('refreshes a source with no data immediately', async () => {
    const repository = createFakeEpgRepository();
    await repository.putSource(source('src1'));
    const refreshSource = vi.fn().mockResolvedValue(undefined);
    const scheduler = createEpgScheduler({ repository, refreshSource, now: () => 0 });

    await scheduler.schedule('pl1');
    await vi.advanceTimersByTimeAsync(0);

    expect(refreshSource).toHaveBeenCalledTimes(1);
    expect(scheduler.getStatus('src1').phase).toBe('ready');
  });

  it('schedules the next refresh one TTL after the last update', async () => {
    const repository = createFakeEpgRepository();
    await repository.putSource(source('src1', 0));
    const refreshSource = vi.fn().mockResolvedValue(undefined);
    const scheduler = createEpgScheduler({ repository, refreshSource, ttlHours: 12, now: () => 0 });

    await scheduler.schedule('pl1');
    expect(refreshSource).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(12 * HOUR + 1);
    expect(refreshSource).toHaveBeenCalledTimes(1);
  });

  it('dedupes concurrent refreshes of the same source', async () => {
    const repository = createFakeEpgRepository();
    await repository.putSource(source('src1'));
    let resolveRefresh: () => void = () => {};
    const refreshSource = vi.fn(
      () => new Promise<void>((resolve) => { resolveRefresh = resolve; })
    );
    const scheduler = createEpgScheduler({ repository, refreshSource, now: () => 0 });

    const first = scheduler.refreshNow('pl1', 'src1');
    const second = scheduler.refreshNow('pl1', 'src1');
    await vi.advanceTimersByTimeAsync(0);
    expect(refreshSource).toHaveBeenCalledTimes(1);
    resolveRefresh();
    await Promise.all([first, second]);

    expect(refreshSource).toHaveBeenCalledTimes(1);
  });

  it('backs off exponentially on failure and resets on success', async () => {
    const repository = createFakeEpgRepository();
    await repository.putSource(source('src1'));
    const statuses: EpgScheduleStatus[] = [];
    const refreshSource = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue(undefined);
    const scheduler = createEpgScheduler({
      repository,
      refreshSource,
      baseBackoffMs: 1000,
      maxBackoffMs: 10_000,
      now: () => 0,
      onStatus: (_id, status) => statuses.push(status),
    });

    await scheduler.refreshNow('pl1', 'src1');
    expect(scheduler.getStatus('src1')).toMatchObject({ phase: 'failed', attempts: 1, nextAt: 1000 });

    await vi.advanceTimersByTimeAsync(1000);
    expect(refreshSource).toHaveBeenCalledTimes(2);
    expect(scheduler.getStatus('src1')).toMatchObject({ phase: 'ready', attempts: 0 });
    expect(statuses.some((s) => s.phase === 'failed')).toBe(true);
  });

  it('caps the backoff', async () => {
    const repository = createFakeEpgRepository();
    await repository.putSource(source('src1'));
    const refreshSource = vi.fn().mockRejectedValue(new Error('boom'));
    const scheduler = createEpgScheduler({
      repository,
      refreshSource,
      baseBackoffMs: 1000,
      maxBackoffMs: 4000,
      now: () => 0,
    });

    await scheduler.refreshNow('pl1', 'src1'); // attempts 0 -> 1000
    await vi.advanceTimersByTimeAsync(1000); // attempts 1 -> 2000
    await vi.advanceTimersByTimeAsync(2000); // attempts 2 -> 4000
    await vi.advanceTimersByTimeAsync(4000); // attempts 3 -> min(8000,4000)=4000

    expect(scheduler.getStatus('src1').nextAt).toBe(0 + 4000);
  });

  it('runs nothing after stop', async () => {
    const repository = createFakeEpgRepository();
    await repository.putSource(source('src1', 0));
    const refreshSource = vi.fn().mockResolvedValue(undefined);
    const scheduler = createEpgScheduler({ repository, refreshSource, now: () => 0 });

    await scheduler.schedule('pl1');
    scheduler.stop();
    await vi.advanceTimersByTimeAsync(24 * HOUR);

    expect(refreshSource).not.toHaveBeenCalled();
  });
});
