import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseXmltvText } from './parseXmltv.ts';
import { decompressGzip, readStreamText } from './fetcher.ts';
import { matchChannels } from '../../domain/epg/matching.ts';

function fixture(name: string): string {
  return path.resolve(process.cwd(), 'src/test/fixtures/epg', name);
}

const NOW = Date.UTC(2026, 0, 4, 14, 0, 0);

const CHANNELS = [
  { id: 'ch_news', name: 'Demo News (720p)', tvgId: 'demo.news' },
  { id: 'ch_sports', name: 'Demo Sports HD', tvgId: 'demo.sports' },
  { id: 'ch_music', name: 'Demo Music 4K', tvgId: 'demo.music' },
];

describe('EPG fixtures', () => {
  const xml = readFileSync(fixture('sample.xml'), 'utf8');

  it('parses the plain XMLTV fixture with multi-timezone times', () => {
    const result = parseXmltvText(xml, { sourceId: 'src1', channels: CHANNELS, now: NOW });

    expect(result.matchReport.matched.map((m) => m.xmltvId).sort()).toEqual([
      'demo.news',
      'demo.sports',
    ]);
    // demo.music is declared after the first programme in this (malformed)
    // fixture, so lazy matching cannot use it — it is still a parsed channel.
    expect(result.channels.map((c) => c.id)).toContain('demo.music');
    expect(result.stats.badDates).toBe(1);
    expect(result.stats.errors).toBeGreaterThanOrEqual(1);

    const evening = result.imports
      .flatMap((entry) => entry.programs)
      .find((program) => program.title === 'Evening Bulletin');
    expect(evening?.start).toBe(Date.UTC(2026, 0, 4, 12, 30, 0));
  });

  it('decompresses the gz fixture to the same XML', async () => {
    const gz = new Uint8Array(readFileSync(fixture('sample.xml.gz')));
    const body = new Response(gz).body;
    expect(body).not.toBeNull();
    const text = await readStreamText(decompressGzip(body as ReadableStream<Uint8Array>));
    expect(text).toBe(xml);
  });

  it('matches messy quality-tagged playlist names to XMLTV display-names', () => {
    const result = parseXmltvText(xml, { sourceId: 'src1', channels: CHANNELS, now: NOW });
    const candidates = result.channels.map((c) => ({ xmltvId: c.id, displayNames: c.displayNames }));

    const report = matchChannels(
      [
        { id: 'ch_news', name: 'Demo News (720p)', tvgName: 'Demo News HD' },
        { id: 'ch_sports', name: 'Demo Sports HD', tvgName: 'Demo Sports' },
      ],
      candidates
    );

    expect(report.matched.map((m) => m.channelId).sort()).toEqual(['ch_news', 'ch_sports']);
    expect(report.unmatched).toEqual([]);
  });
});
