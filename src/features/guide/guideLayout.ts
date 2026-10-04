/**
 * Pure layout math for the Guide timeline. No React, no I/O. Day boundaries
 * are local-time so "today" matches the viewer's clock.
 */

import type { Program } from '../../domain/types.ts';

export const GUIDE_COLUMN_MS = 30 * 60 * 1000;
export const GUIDE_COLUMNS = (24 * 60 * 60 * 1000) / GUIDE_COLUMN_MS; // 48

export interface GuideProgramLayout {
  program: Program;
  /** Left offset within the day, in px. */
  x: number;
  /** Visible width in px. */
  width: number;
  /** Programme start clipped to the day. */
  clippedStart: number;
  /** Programme stop clipped to the day. */
  clippedStop: number;
}

/** Local midnight of the day `offset` days from `now` (0 = today). */
export function guideDayStart(now: number, offset: number): number {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date.getTime();
}

export function guideDayEnd(dayStart: number): number {
  return guideDayStart(dayStart, 1);
}

/** Layouts programmes that intersect `[dayStart, dayEnd)`, clipped to it. */
export function layoutPrograms(
  programs: readonly Program[],
  dayStart: number,
  dayEnd: number,
  columnWidth: number
): GuideProgramLayout[] {
  const pxPerMs = columnWidth / GUIDE_COLUMN_MS;
  const layouts: GuideProgramLayout[] = [];
  for (const program of programs) {
    const clippedStart = Math.max(program.start, dayStart);
    const clippedStop = Math.min(program.stop, dayEnd);
    if (clippedStop <= clippedStart) continue;
    layouts.push({
      program,
      x: (clippedStart - dayStart) * pxPerMs,
      width: Math.max(2, (clippedStop - clippedStart) * pxPerMs),
      clippedStart,
      clippedStop,
    });
  }
  return layouts.sort((a, b) => a.x - b.x);
}

/** Timeline x for an instant, clamped to the day. */
export function timeToX(ms: number, dayStart: number, dayEnd: number, columnWidth: number): number {
  const clamped = Math.min(Math.max(ms, dayStart), dayEnd);
  return (clamped - dayStart) * (columnWidth / GUIDE_COLUMN_MS);
}
