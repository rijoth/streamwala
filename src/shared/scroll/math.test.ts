import { describe, it, expect } from 'vitest';
import { DEFAULT_SCROLL_CONFIG, resolveScrollConfig } from './config.ts';
import {
  carouselOffset,
  clamp,
  columnForIndex,
  cubicBezier,
  emphasizedDecelerate,
  focusLineOffset,
  gridColumns,
  gridRows,
  interpolate,
  isRowAtFocusLine,
  maxOffset,
  minimalScrollOffset,
  repeatStep,
  retargetTween,
  rowForIndex,
  rowPrefixOffset,
  rowSnapOffset,
  shouldBlockRepeat,
  stepTween,
  visibleRange,
} from './math.ts';

const CFG = DEFAULT_SCROLL_CONFIG;

describe('scroll/math basics', () => {
  it('clamps values into range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
    expect(clamp(NaN, 2, 10)).toBe(2);
    expect(clamp(5, 10, 0)).toBe(10);
  });

  it('computes max offset', () => {
    expect(maxOffset(1000, 400)).toBe(600);
    expect(maxOffset(300, 400)).toBe(0);
  });

  it('computes focus line from viewport', () => {
    expect(focusLineOffset(1080, CFG)).toBeCloseTo(410.4);
  });

  it('resolves config overrides', () => {
    expect(resolveScrollConfig({ focusLine: 0.5 }).focusLine).toBe(0.5);
    expect(resolveScrollConfig({ focusLine: 0.5 }).duration).toBe(CFG.duration);
    expect(resolveScrollConfig()).toBe(CFG);
  });
});

describe('row math', () => {
  it('sums row prefixes', () => {
    expect(rowPrefixOffset([100, 200, 300], 0)).toBe(0);
    expect(rowPrefixOffset([100, 200, 300], 2)).toBe(300);
    expect(rowPrefixOffset([100, 200, 300], 9)).toBe(600);
    expect(rowPrefixOffset([100], -3)).toBe(0);
  });

  it('snaps a row to the focus line', () => {
    // 1080 viewport, focus line 410.4, row top 1000 -> offset 589.6 (within range).
    expect(rowSnapOffset(1000, 1080, 4000, CFG)).toBeCloseTo(589.6);
  });

  it('clamps row snap at the top', () => {
    expect(rowSnapOffset(100, 1080, 4000, CFG)).toBe(0);
  });

  it('clamps row snap at the bottom', () => {
    expect(rowSnapOffset(3900, 1080, 4000, CFG)).toBe(maxOffset(4000, 1080));
  });

  it('accepts a row resting on the focus line or a boundary', () => {
    const offset = rowSnapOffset(1000, 1080, 4000, CFG);
    expect(isRowAtFocusLine(offset, 1000, 240, 1080, 4000, CFG)).toBe(true);
    expect(isRowAtFocusLine(0, 410.4, 240, 1080, 4000, CFG)).toBe(true);
    expect(isRowAtFocusLine(0, 2000, 240, 1080, 4000, CFG)).toBe(false);
  });
});

describe('carousel math', () => {
  it('does not move while focus is inside the leading slots', () => {
    expect(carouselOffset(0, 200, 16, 800, 5000, CFG)).toBe(0);
    expect(carouselOffset(1, 200, 16, 800, 5000, CFG)).toBe(0);
  });

  it('keeps focus in the fixed slot once passed it', () => {
    expect(carouselOffset(2, 200, 16, 800, 5000, CFG)).toBe(216);
    expect(carouselOffset(5, 200, 16, 800, 5000, CFG)).toBe(4 * 216);
  });

  it('clamps the trailing edge', () => {
    expect(carouselOffset(50, 200, 16, 800, 1000, CFG)).toBe(200);
  });

  it('honours a third-slot config', () => {
    const cfg = resolveScrollConfig({ carouselSlot: 2 });
    expect(carouselOffset(2, 200, 0, 800, 5000, cfg)).toBe(0);
    expect(carouselOffset(3, 200, 0, 800, 5000, cfg)).toBe(200);
  });
});

describe('grid math', () => {
  it('derives column count from width', () => {
    expect(gridColumns(1000, 200, 16)).toBe(4);
    expect(gridColumns(100, 200, 16)).toBe(1);
    expect(gridColumns(5000, 100, 0)).toBe(8);
  });

  it('derives rows and indices', () => {
    expect(gridRows(10, 4)).toBe(3);
    expect(gridRows(10, 0)).toBe(0);
    expect(rowForIndex(7, 4)).toBe(1);
    expect(columnForIndex(7, 4)).toBe(3);
    expect(columnForIndex(-1, 4)).toBe(3);
  });

  it('is a no-op while focus is comfortably inside the viewport', () => {
    const offset = minimalScrollOffset(0, 2, 100, 500, 5000, CFG);
    expect(offset).toBe(0);
  });

  it('scrolls one row when focus nears the bottom edge', () => {
    // 5 visible rows, focus row 4 is the last -> scroll so it keeps margin 1.
    expect(minimalScrollOffset(0, 4, 100, 500, 5000, CFG)).toBe(100);
  });

  it('scrolls up when focus nears the top edge', () => {
    expect(minimalScrollOffset(400, 4, 100, 500, 5000, CFG)).toBe(300);
  });

  it('clamps minimal scroll to the content bounds', () => {
    expect(minimalScrollOffset(0, 0, 100, 500, 500, CFG)).toBe(0);
    expect(minimalScrollOffset(0, 100, 100, 500, 500, CFG)).toBe(0);
  });
});

describe('visible range windowing', () => {
  it('returns the visible slice plus overscan', () => {
    expect(visibleRange(0, 400, 100, 1000, 2)).toEqual({ start: 0, end: 6 });
    expect(visibleRange(1000, 400, 100, 1000, 2)).toEqual({ start: 8, end: 16 });
  });

  it('clamps to list bounds', () => {
    expect(visibleRange(0, 100, 50, 3, 5)).toEqual({ start: 0, end: 3 });
    expect(visibleRange(0, 100, 0, 10, 2)).toEqual({ start: 0, end: 0 });
    expect(visibleRange(0, 100, 50, 0, 2)).toEqual({ start: 0, end: 0 });
  });
});

describe('key repeat', () => {
  it('throttles repeats inside the window', () => {
    expect(shouldBlockRepeat(1000, 1050, CFG)).toBe(true);
    expect(shouldBlockRepeat(1000, 1100, CFG)).toBe(false);
  });

  it('accelerates after the hold threshold and caps', () => {
    expect(repeatStep(0, CFG)).toBe(1);
    expect(repeatStep(499, CFG)).toBe(1);
    expect(repeatStep(500, CFG)).toBe(2);
    expect(repeatStep(1000, CFG)).toBe(4);
    expect(repeatStep(10_000, CFG)).toBe(CFG.maxRepeatStep);
  });
});

describe('easing and tween', () => {
  it('eases endpoints and stays monotonic', () => {
    expect(emphasizedDecelerate(0)).toBeCloseTo(0, 4);
    expect(emphasizedDecelerate(1)).toBeCloseTo(1, 4);
    let prev = -1;
    for (let t = 0; t <= 1; t += 0.05) {
      const v = emphasizedDecelerate(t);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it('supports custom bezier curves', () => {
    const linearish = cubicBezier(0.25, 0.25, 0.75, 0.75);
    expect(linearish(0.5)).toBeCloseTo(0.5, 2);
  });

  it('interpolates', () => {
    expect(interpolate(0, 100, 0.25)).toBe(25);
  });

  it('steps a tween to completion', () => {
    const state = { from: 0, to: 200, startTime: 0, duration: 100 };
    expect(stepTween(state, 0).value).toBe(0);
    expect(stepTween(state, 50).done).toBe(false);
    expect(stepTween(state, 100)).toEqual({ value: 200, done: true });
    expect(stepTween(state, 500)).toEqual({ value: 200, done: true });
  });

  it('treats a zero duration as instant', () => {
    expect(stepTween({ from: 0, to: 10, startTime: 0, duration: 0 }, 0)).toEqual({
      value: 10,
      done: true,
    });
  });

  it('retargets mid-flight from the current value', () => {
    const state = { from: 0, to: 100, startTime: 0, duration: 100 };
    const now = 50;
    const current = stepTween(state, now).value;
    const next = retargetTween(state, 400, now);
    expect(next.from).toBeCloseTo(current);
    expect(next.to).toBe(400);
    expect(next.startTime).toBe(now);
    // A later target wins and still ends exactly on it.
    const final = retargetTween(next, -50, now + 10);
    expect(stepTween(final, now + 10 + final.duration).value).toBe(-50);
  });
});
