/**
 * Now/Next selector behind one call: `getNowNext(channelId, now)`. Queries a
 * channel + time window through the repository and caches the programme list
 * briefly so many cards/tickers don't hammer Dexie.
 */

import type { Program } from '../../domain/types.ts';
import { getNowNext, type NowNext } from '../../domain/epg/nowNext.ts';
import type { EpgRepository } from './repository.ts';

export interface NowNextService {
  getNowNext(channelId: string, now: number): Promise<NowNext<Program>>;
  invalidate(channelId?: string): void;
}

const LOOKBACK_MS = 6 * 3_600_000;
const LOOKAHEAD_MS = 12 * 3_600_000;
const CACHE_TTL_MS = 60_000;

export function createNowNextService(repository: EpgRepository): NowNextService {
  const cache = new Map<string, { at: number; programs: Program[] }>();

  return {
    async getNowNext(channelId, now) {
      const cached = cache.get(channelId);
      let programs: Program[];
      if (cached && now - cached.at < CACHE_TTL_MS) {
        programs = cached.programs;
      } else {
        programs = await repository.getPrograms(
          channelId,
          now - LOOKBACK_MS,
          now + LOOKAHEAD_MS
        );
        cache.set(channelId, { at: now, programs });
      }
      return getNowNext(programs, now);
    },
    invalidate(channelId) {
      if (channelId) cache.delete(channelId);
      else cache.clear();
    },
  };
}
