import { test } from 'vitest';
import assert from 'node:assert/strict';
import { parseXmltvDate } from './xmltvParser.ts';

const base = Date.UTC(2026, 9, 4, 3, 0, 0); // 2026-10-04T03:00:00Z

test('parses UTC timestamps with and without an offset', () => {
  assert.equal(parseXmltvDate('20261004030000'), base);
  assert.equal(parseXmltvDate('20261004030000 +0000'), base);
});

test('parses signed offsets (+0530 / -0800)', () => {
  assert.equal(parseXmltvDate('20261004030000 +0530'), base - 5.5 * 3600_000);
  assert.equal(parseXmltvDate('20261004030000 -0800'), base + 8 * 3600_000);
});

test('parses compact offsets without a separating space', () => {
  assert.equal(parseXmltvDate('20261004030000+0530'), base - 5.5 * 3600_000);
  assert.equal(parseXmltvDate('20261004030000-0800'), base + 8 * 3600_000);
});

test('parses two-digit hour offsets', () => {
  assert.equal(parseXmltvDate('20261004030000 +05'), base - 5 * 3600_000);
});

test('returns a finite timestamp for malformed input', () => {
  assert.ok(Number.isFinite(parseXmltvDate('')));
  assert.ok(Number.isFinite(parseXmltvDate('not-a-date')));
});
