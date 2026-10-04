import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PROGRAMME_DURATION_MS,
  applyTvgShift,
  parseXmltvDate,
  resolveProgrammeStop,
} from './time.ts';

const base = Date.UTC(2026, 9, 4, 3, 0, 0); // 2026-10-04T03:00:00Z

describe('parseXmltvDate', () => {
  it('parses UTC timestamps with and without an offset', () => {
    expect(parseXmltvDate('20261004030000')).toBe(base);
    expect(parseXmltvDate('20261004030000 +0000')).toBe(base);
    expect(parseXmltvDate('20261004030000+0000')).toBe(base);
    expect(parseXmltvDate('20261004030000 -0000')).toBe(base);
  });

  it('parses signed offsets with and without a separating space', () => {
    expect(parseXmltvDate('20261004030000 +0530')).toBe(base - 5.5 * 3600_000);
    expect(parseXmltvDate('20261004030000+0530')).toBe(base - 5.5 * 3600_000);
    expect(parseXmltvDate('20261004030000 -0800')).toBe(base + 8 * 3600_000);
    expect(parseXmltvDate('20261004030000-0800')).toBe(base + 8 * 3600_000);
  });

  it('parses two-digit and colon offsets', () => {
    expect(parseXmltvDate('20261004030000 +05')).toBe(base - 5 * 3600_000);
    expect(parseXmltvDate('20261004030000 +05:30')).toBe(base - 5.5 * 3600_000);
    expect(parseXmltvDate('20261004030000 -08:00')).toBe(base + 8 * 3600_000);
  });

  it('accepts timestamps without seconds', () => {
    expect(parseXmltvDate('202610040300')).toBe(base);
    expect(parseXmltvDate('202610040300 +0530')).toBe(base - 5.5 * 3600_000);
  });

  it('converts offsets rather than local time across a DST change', () => {
    // US spring-forward: 02:00 -0800 and 03:00 -0700 are the same instant.
    expect(parseXmltvDate('20260308020000 -0800')).toBe(parseXmltvDate('20260308030000 -0700'));
    // EU fall-back: 02:00 +0200 and 01:00 +0100 are the same instant.
    expect(parseXmltvDate('20261025020000 +0200')).toBe(parseXmltvDate('20261025010000 +0100'));
  });

  it('returns NaN for malformed input instead of substituting "now"', () => {
    expect(Number.isNaN(parseXmltvDate(''))).toBe(true);
    expect(Number.isNaN(parseXmltvDate('not-a-date'))).toBe(true);
    expect(Number.isNaN(parseXmltvDate('2026'))).toBe(true);
    expect(Number.isNaN(parseXmltvDate('20261301000000'))).toBe(true); // month 13
    expect(Number.isNaN(parseXmltvDate('20260230000000'))).toBe(true); // Feb 30
    expect(Number.isNaN(parseXmltvDate('20261004030000 garbage'))).toBe(true);
  });
});

describe('applyTvgShift', () => {
  it('adds whole hours and ignores missing/zero shifts', () => {
    expect(applyTvgShift(base, 3)).toBe(base + 3 * 3600_000);
    expect(applyTvgShift(base, -1)).toBe(base - 3600_000);
    expect(applyTvgShift(base, undefined)).toBe(base);
    expect(applyTvgShift(base, 0)).toBe(base);
    expect(Number.isNaN(applyTvgShift(Number.NaN, 2))).toBe(true);
  });
});

describe('resolveProgrammeStop', () => {
  it('keeps a valid stop', () => {
    expect(resolveProgrammeStop({ start: 1000, stop: 5000 })).toBe(5000);
  });

  it("falls back to the next programme's start", () => {
    expect(resolveProgrammeStop({ start: 1000, stop: undefined, nextStart: 9000 })).toBe(9000);
  });

  it('falls back to the default duration when there is no next programme', () => {
    expect(resolveProgrammeStop({ start: 1000 })).toBe(1000 + DEFAULT_PROGRAMME_DURATION_MS);
    expect(resolveProgrammeStop({ start: 1000, defaultDurationMs: 60_000 })).toBe(61_000);
  });

  it('ignores a stop at or before start', () => {
    expect(resolveProgrammeStop({ start: 1000, stop: 500 })).toBe(
      1000 + DEFAULT_PROGRAMME_DURATION_MS
    );
    expect(resolveProgrammeStop({ start: 1000, stop: 1000, nextStart: 4000 })).toBe(4000);
  });
});
