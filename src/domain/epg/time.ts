/**
 * Pure XMLTV time handling. No React, no I/O.
 *
 * XMLTV timestamps look like `20260104180000 +0530`:
 *   YYYYMMDDHHmmss with an optional numeric offset.
 *
 * Rules (XMLTV DTD):
 * - The offset accepts `+0530`, `+05:30`, `+05` and the compact no-space form.
 * - A missing offset means the wall clock is UTC, so parsing never depends on
 *   the browser timezone or DST: we always build the instant with `Date.UTC`
 *   and subtract the declared offset.
 * - Anything unparseable returns `NaN`; callers skip and count it instead of
 *   silently substituting "now" (which made bad rows look current).
 */

export const DEFAULT_PROGRAMME_DURATION_MS = 30 * 60 * 1000;

const XMLTV_DATE_RE =
  /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?(?:\s*([+-])(\d{2}):?(\d{2})?)?\s*$/;

/**
 * Parses an XMLTV timestamp to epoch milliseconds, or `NaN` when malformed.
 */
export function parseXmltvDate(dateStr: string): number {
  if (!dateStr) return Number.NaN;
  const match = XMLTV_DATE_RE.exec(dateStr.trim());
  if (!match) return Number.NaN;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = match[6] ? Number(match[6]) : 0;

  if (month < 1 || month > 12) return Number.NaN;
  if (day < 1 || day > 31) return Number.NaN;
  if (hour > 23 || minute > 59 || second > 60) return Number.NaN;

  const sign = match[7];
  const offsetHours = match[8] ? Number(match[8]) : 0;
  const offsetMinutes = match[9] ? Number(match[9]) : 0;
  const offset =
    sign === '-' ? -(offsetHours * 60 + offsetMinutes) : offsetHours * 60 + offsetMinutes;

  const utc = Date.UTC(year, month - 1, day, hour, minute, second);

  // Date.UTC rolls invalid days (e.g. Feb 30) into the next month. Reject those
  // instead of silently shifting a programme into the wrong day.
  const check = new Date(utc);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return Number.NaN;
  }

  return utc - offset * 60 * 1000;
}

/** Applies a per-channel `tvg-shift` (in hours) to an instant. */
export function applyTvgShift(epochMs: number, shiftHours: number | undefined): number {
  if (!Number.isFinite(epochMs) || !shiftHours) return epochMs;
  return epochMs + shiftHours * 60 * 60 * 1000;
}

export interface ResolveStopInput {
  start: number;
  stop?: number;
  /** The next programme's start, used when `stop` is missing. */
  nextStart?: number;
  defaultDurationMs?: number;
}

/**
 * Resolves a programme's end time:
 * 1. a valid `stop` after `start`,
 * 2. otherwise the next programme's `start`,
 * 3. otherwise `start + defaultDurationMs` (30 min by default).
 */
export function resolveProgrammeStop(input: ResolveStopInput): number {
  const { start, stop, nextStart, defaultDurationMs = DEFAULT_PROGRAMME_DURATION_MS } = input;
  if (typeof stop === 'number' && Number.isFinite(stop) && stop > start) return stop;
  if (typeof nextStart === 'number' && Number.isFinite(nextStart) && nextStart > start) {
    return nextStart;
  }
  return start + defaultDurationMs;
}
