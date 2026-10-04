import { describe, it, expect } from 'vitest';
import type { Program } from '../../domain/types.ts';
import {
  GUIDE_COLUMNS,
  GUIDE_COLUMN_MS,
  guideDayEnd,
  guideDayStart,
  layoutPrograms,
  timeToX,
} from './guideLayout.ts';

function program(id: string, start: number, stop: number): Program {
  return { id, channelId: 'ch1', start, stop, title: id };
}

describe('guideLayout', () => {
  it('has 48 half-hour columns per day', () => {
    expect(GUIDE_COLUMNS).toBe(48);
    expect(GUIDE_COLUMNS * GUIDE_COLUMN_MS).toBe(24 * 60 * 60 * 1000);
  });

  it('computes local day bounds with day offsets', () => {
    const now = Date.UTC(2026, 5, 15, 12, 0, 0);
    const today = guideDayStart(now, 0);
    const tomorrow = guideDayStart(now, 1);
    expect(new Date(today).getHours()).toBe(0);
    expect(tomorrow - today).toBe(24 * 60 * 60 * 1000);
    expect(guideDayEnd(today)).toBe(tomorrow);
  });

  it('clips and positions programmes within the day', () => {
    const dayStart = guideDayStart(Date.now(), 0);
    const dayEnd = guideDayEnd(dayStart);
    const layouts = layoutPrograms(
      [
        program('morning', dayStart + 60 * 60 * 1000, dayStart + 90 * 60 * 1000),
        program('crossing', dayStart - 60 * 60 * 1000, dayStart + 30 * 60 * 1000),
        program('outside', dayEnd + 1000, dayEnd + 2000),
      ],
      dayStart,
      dayEnd,
      96
    );

    expect(layouts.map((l) => l.program.id)).toEqual(['crossing', 'morning']);
    expect(layouts[0].x).toBe(0);
    expect(layouts[0].clippedStart).toBe(dayStart);
    expect(layouts[0].width).toBe(96); // clipped to a 30-minute column
    expect(layouts[1].x).toBe(96 * 2); // 1h into a 30-min column grid
  });

  it('clamps the now marker to the day', () => {
    const dayStart = guideDayStart(Date.now(), 0);
    const dayEnd = guideDayEnd(dayStart);
    expect(timeToX(dayStart - 1000, dayStart, dayEnd, 96)).toBe(0);
    expect(timeToX(dayEnd + 1000, dayStart, dayEnd, 96)).toBe(96 * GUIDE_COLUMNS);
  });
});
