import { describe, it, expect } from 'vitest';
import { createFakeEpgRepository } from './fakeRepository.ts';
import { createNowNextService } from './nowNextService.ts';

const NOW = 1_000_000;

describe('createNowNextService', () => {
  it('returns the airing and next programmes', async () => {
    const repository = createFakeEpgRepository();
    await repository.applyProgrammeImport([
      {
        channelId: 'ch1',
        programs: [
          { id: 'a', channelId: 'ch1', start: NOW - 1000, stop: NOW + 1000, title: 'Now' },
          { id: 'b', channelId: 'ch1', start: NOW + 1000, stop: NOW + 2000, title: 'Next' },
        ],
      },
    ]);
    const service = createNowNextService(repository);

    const result = await service.getNowNext('ch1', NOW);
    expect(result.current?.title).toBe('Now');
    expect(result.next?.title).toBe('Next');
  });

  it('serves a cached window and clears on invalidate', async () => {
    const repository = createFakeEpgRepository();
    await repository.applyProgrammeImport([
      { channelId: 'ch1', programs: [{ id: 'a', channelId: 'ch1', start: NOW, stop: NOW + 1000, title: 'A' }] },
    ]);
    const service = createNowNextService(repository);

    expect((await service.getNowNext('ch1', NOW)).current?.title).toBe('A');

    // A new programme is invisible until the cache is invalidated.
    await repository.applyProgrammeImport([
      { channelId: 'ch1', programs: [{ id: 'b', channelId: 'ch1', start: NOW, stop: NOW + 1000, title: 'B' }] },
    ]);
    expect((await service.getNowNext('ch1', NOW + 1)).current?.title).toBe('A');

    service.invalidate('ch1');
    expect((await service.getNowNext('ch1', NOW + 1)).current?.title).toBe('B');
  });

  it('returns an empty result for a channel with no data', async () => {
    const service = createNowNextService(createFakeEpgRepository());
    expect(await service.getNowNext('missing', NOW)).toEqual({
      current: undefined,
      next: undefined,
    });
  });
});
