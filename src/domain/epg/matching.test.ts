import { describe, it, expect } from 'vitest';
import {
  diceCoefficient,
  matchChannelToEpg,
  matchChannels,
  normalizeChannelName,
  type EpgChannelCandidate,
} from './matching.ts';

const cnn: EpgChannelCandidate = { xmltvId: 'CNN.US', displayNames: ['CNN'] };

describe('normalizeChannelName', () => {
  it('strips quality tags, diacritics, punctuation and country affixes', () => {
    expect(normalizeChannelName('Sports (720p) HD')).toBe('sports');
    expect(normalizeChannelName('Café TV')).toBe('cafe tv');
    expect(normalizeChannelName('Discovery+')).toBe('discovery');
    expect(normalizeChannelName('US: CNN')).toBe('cnn');
    expect(normalizeChannelName('[UK] BBC One')).toBe('bbc one');
    expect(normalizeChannelName('4K Ultra')).toBe('ultra');
  });
});

describe('diceCoefficient', () => {
  it('is 1 for equal strings and 0 for empty input', () => {
    expect(diceCoefficient('abc', 'abc')).toBe(1);
    expect(diceCoefficient('', 'abc')).toBe(0);
    expect(diceCoefficient('a', 'b')).toBe(0);
  });

  it('scores close variants above distant ones', () => {
    const close = diceCoefficient('discovery channel', 'discovery channell');
    const far = diceCoefficient('discovery channel', 'completely different');
    expect(close).toBeGreaterThan(far);
    expect(close).toBeGreaterThan(0.86);
  });
});

describe('matchChannelToEpg', () => {
  it('tier 1: matches an exact tvg-id case-insensitively and trimmed', () => {
    const result = matchChannelToEpg(
      { id: 'ch1', name: 'Anything', tvgId: '  cnn.us ' },
      [cnn]
    );
    expect(result).toEqual({
      kind: 'matched',
      match: { channelId: 'ch1', xmltvId: 'CNN.US', method: 'tvg-id', confidence: 1 },
    });
  });

  it('tier 1 wins over a conflicting name match', () => {
    const result = matchChannelToEpg(
      { id: 'ch1', name: 'BBC One', tvgId: 'CNN.US' },
      [cnn]
    );
    expect(result.kind).toBe('matched');
    if (result.kind === 'matched') expect(result.match.method).toBe('tvg-id');
  });

  it('tier 2: matches a normalized tvg-name / name against display-name', () => {
    const result = matchChannelToEpg(
      { id: 'ch2', name: 'Sports HD (720p)', tvgName: 'Sports' },
      [{ xmltvId: 'x1', displayNames: ['Sports'] }]
    );
    expect(result).toEqual({
      kind: 'matched',
      match: { channelId: 'ch2', xmltvId: 'x1', method: 'name', confidence: 0.95 },
    });
  });

  it('tier 2: quality tags and diacritics do not break matching', () => {
    const result = matchChannelToEpg(
      { id: 'ch3', name: 'ESPN (1080p)' },
      [{ xmltvId: 'x2', displayNames: ['ESPN HD'] }]
    );
    expect(result.kind).toBe('matched');
    if (result.kind === 'matched') expect(result.match.xmltvId).toBe('x2');

    const diacritic = matchChannelToEpg(
      { id: 'ch4', name: 'Café TV' },
      [{ xmltvId: 'x3', displayNames: ['Cafe TV'] }]
    );
    expect(diacritic.kind).toBe('matched');
  });

  it('never auto-maps a tier 2 tie', () => {
    const result = matchChannelToEpg(
      { id: 'ch5', name: 'News' },
      [
        { xmltvId: 'a', displayNames: ['News'] },
        { xmltvId: 'b', displayNames: ['News'] },
      ]
    );
    expect(result.kind).toBe('ambiguous');
    if (result.kind === 'ambiguous') {
      expect(result.candidates.map((c) => c.xmltvId).sort()).toEqual(['a', 'b']);
    }
  });

  it('tier 3: fuzzy-matches an unambiguous near miss', () => {
    const result = matchChannelToEpg(
      { id: 'ch6', name: 'Discovery Channel' },
      [{ xmltvId: 'd1', displayNames: ['Discovery Channell'] }]
    );
    expect(result.kind).toBe('matched');
    if (result.kind === 'matched') {
      expect(result.match.method).toBe('fuzzy');
      expect(result.match.confidence).toBeGreaterThanOrEqual(0.86);
    }
  });

  it('tier 3: never auto-maps a fuzzy tie', () => {
    const result = matchChannelToEpg(
      { id: 'ch7', name: 'National Geographi' },
      [
        { xmltvId: 'n1', displayNames: ['National Geographic'] },
        { xmltvId: 'n2', displayNames: ['National Geographik'] },
      ]
    );
    expect(result.kind).toBe('ambiguous');
  });

  it('tier 3: leaves a distant candidate unmatched', () => {
    const result = matchChannelToEpg(
      { id: 'ch8', name: 'Completely Different' },
      [{ xmltvId: 'z', displayNames: ['Something Else Entirely'] }]
    );
    expect(result).toEqual({ kind: 'unmatched' });
  });

  it('reports unmatched when the channel has no usable name', () => {
    const result = matchChannelToEpg({ id: 'ch9', name: '(720p)' }, [cnn]);
    expect(result).toEqual({ kind: 'unmatched' });
  });
});

describe('matchChannels report', () => {
  it('classifies matched, unmatched and ambiguous channels', () => {
    const report = matchChannels(
      [
        { id: 'ok', name: 'CNN' },
        { id: 'amb', name: 'News' },
        { id: 'none', name: 'Completely Different' },
      ],
      [
        cnn,
        { xmltvId: 'a', displayNames: ['News'] },
        { xmltvId: 'b', displayNames: ['News'] },
      ]
    );

    expect(report.matched.map((m) => m.channelId)).toEqual(['ok']);
    expect(report.ambiguous.map((a) => a.channelId)).toEqual(['amb']);
    expect(report.unmatched).toEqual(['none']);
  });
});
