import { describe, it, expect } from 'vitest';
import { getNowNext, programProgress } from './nowNext.ts';

interface Span {
  start: number;
  stop: number;
}

const A: Span = { start: 0, stop: 100 };
const B: Span = { start: 100, stop: 200 };
const C: Span = { start: 250, stop: 350 };

describe('getNowNext', () => {
  it('selects the airing programme and the next one', () => {
    expect(getNowNext([A, B, C], 50)).toEqual({ current: A, next: B });
  });

  it('treats start as inclusive and stop as exclusive', () => {
    expect(getNowNext([A, B, C], 100)).toEqual({ current: B, next: C });
    expect(getNowNext([A, B, C], 200)).toEqual({ current: undefined, next: C });
  });

  it('returns an empty current inside a gap', () => {
    expect(getNowNext([A, B, C], 225)).toEqual({ current: undefined, next: C });
  });

  it('has no next for the last programme and no current before the first', () => {
    expect(getNowNext([A, B, C], 250)).toEqual({ current: C, next: undefined });
    expect(getNowNext([A, B, C], -1)).toEqual({ current: undefined, next: A });
  });

  it('resolves overlapping programmes by the latest start', () => {
    const early: Span = { start: 0, stop: 100 };
    const late: Span = { start: 50, stop: 150 };
    expect(getNowNext([early, late], 75).current).toBe(late);
  });

  it('ignores invalid spans and empty input', () => {
    const bad: Span = { start: Number.NaN, stop: 10 };
    expect(getNowNext([], 5)).toEqual({ current: undefined, next: undefined });
    expect(getNowNext([bad], 5)).toEqual({ current: undefined, next: undefined });
  });
});

describe('programProgress', () => {
  it('clamps to 0..1', () => {
    expect(programProgress(A, 0)).toBe(0);
    expect(programProgress(A, 50)).toBe(0.5);
    expect(programProgress(A, 100)).toBe(1);
    expect(programProgress(A, 150)).toBe(1);
    expect(programProgress(A, -10)).toBe(0);
  });

  it('returns 0 for invalid spans', () => {
    expect(programProgress({ start: 100, stop: 100 }, 100)).toBe(0);
    expect(programProgress({ start: 100, stop: 50 }, 60)).toBe(0);
  });
});
