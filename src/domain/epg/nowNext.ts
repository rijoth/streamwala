/**
 * Pure Now/Next selection. No React, no I/O.
 *
 * The app-facing selector `getNowNext(channelId, now)` lives in the services
 * layer (it queries the EPG repository); this module is the deterministic core
 * it delegates to, so it is cheap to unit-test and safe to call in a render.
 */

export interface ProgramTimeSpan {
  start: number;
  stop: number;
}

export interface NowNext<T extends ProgramTimeSpan = ProgramTimeSpan> {
  current?: T;
  next?: T;
}

/**
 * Picks the programme airing at `now` (`start <= now < stop`) and the earliest
 * programme that starts after `now`.
 *
 * Overlapping programmes are resolved deterministically: the one with the
 * latest `start` wins, matching "most specific wins" without depending on
 * array order.
 */
export function getNowNext<T extends ProgramTimeSpan>(
  programs: readonly T[],
  now: number
): NowNext<T> {
  let current: T | undefined;
  let next: T | undefined;

  for (const program of programs) {
    if (!Number.isFinite(program.start) || !Number.isFinite(program.stop)) continue;

    if (program.start <= now && now < program.stop) {
      if (!current || program.start > current.start) current = program;
    }
    if (program.start > now) {
      if (!next || program.start < next.start) next = program;
    }
  }

  return { current, next };
}

/** Fraction (0..1) of a programme elapsed at `now`; 0 for invalid spans. */
export function programProgress(program: ProgramTimeSpan, now: number): number {
  const duration = program.stop - program.start;
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return Math.min(1, Math.max(0, (now - program.start) / duration));
}
