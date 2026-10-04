import { describe, it, expect } from 'vitest';
import { createXmltvParser, parseXmltvText, type EpgParserChannel } from './parseXmltv.ts';

const NOW = Date.UTC(2026, 0, 4, 12, 0, 0);
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function xmltvTime(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number, l = 2) => String(n).padStart(l, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())} +0000`;
}

function channel(attrs: string, displayNames: string[]): string {
  const names = displayNames.map((n) => `<display-name>${n}</display-name>`).join('');
  return `<channel ${attrs}>${names}</channel>`;
}

function programme(channelId: string, start: number, stop: number | null, body = '<title>T</title>'): string {
  const stopAttr = stop === null ? '' : ` stop="${xmltvTime(stop)}"`;
  return `<programme channel="${channelId}" start="${xmltvTime(start)}"${stopAttr}>${body}</programme>`;
}

function parse(xml: string, channels: EpgParserChannel[], extra: Partial<Parameters<typeof parseXmltvText>[1]> = {}) {
  return parseXmltvText(`<tv>${xml}</tv>`, {
    sourceId: 'src1',
    channels,
    now: NOW,
    ...extra,
  });
}

describe('parseXmltv', () => {
  it('matches by tvg-id and extracts programme fields', () => {
    const xml =
      channel('id="cnn.us"', ['CNN']) +
      programme(
        'cnn.us',
        NOW - HOUR,
        NOW + HOUR,
        '<title>Now Show</title><sub-title>Sub</sub-title><desc>Details</desc><category>News</category><episode-num>1.2</episode-num><language>en</language><rating>TV-PG</rating>'
      );

    const result = parse(xml, [{ id: 'ch1', name: 'CNN', tvgId: 'cnn.us' }]);

    expect(result.matchReport.matched).toEqual([
      { channelId: 'ch1', xmltvId: 'cnn.us', method: 'tvg-id', confidence: 1 },
    ]);
    expect(result.imports).toHaveLength(1);
    const [program] = result.imports[0].programs;
    expect(program).toMatchObject({
      id: `prog_ch1_${NOW - HOUR}`,
      channelId: 'ch1',
      tvgId: 'cnn.us',
      sourceId: 'src1',
      start: NOW - HOUR,
      stop: NOW + HOUR,
      title: 'Now Show',
      subTitle: 'Sub',
      description: 'Details',
      category: 'News',
      episodeNumber: '1.2',
      language: 'en',
      rating: 'TV-PG',
    });
  });

  it('keeps only programmes inside the retention window', () => {
    const xml =
      channel('id="c"', ['C']) +
      programme('c', NOW - 10 * DAY, NOW - 10 * DAY + HOUR) +
      programme('c', NOW + 10 * DAY, NOW + 10 * DAY + HOUR) +
      programme('c', NOW - HOUR, NOW + HOUR);

    const result = parse(xml, [{ id: 'ch1', name: 'C', tvgId: 'c' }]);
    expect(result.imports[0].programs).toHaveLength(1);
    expect(result.stats.programmesSkipped).toBe(2);
  });

  it("fills a missing stop from the next programme's start", () => {
    const xml =
      channel('id="c"', ['C']) +
      programme('c', NOW, null, '<title>First</title>') +
      programme('c', NOW + HOUR, NOW + 2 * HOUR, '<title>Second</title>');

    const result = parse(xml, [{ id: 'ch1', name: 'C', tvgId: 'c' }]);
    const [first, second] = result.imports[0].programs;
    expect(first.stop).toBe(NOW + HOUR);
    expect(second.start).toBe(NOW + HOUR);
  });

  it('trims overlapping programmes instead of dropping them', () => {
    const xml =
      channel('id="c"', ['C']) +
      programme('c', NOW - 3 * HOUR, NOW - 2 * HOUR, '<title>A</title>') +
      programme('c', NOW - 2.5 * HOUR, NOW - 1.5 * HOUR, '<title>B</title>');

    const result = parse(xml, [{ id: 'ch1', name: 'C', tvgId: 'c' }]);
    const programs = result.imports[0].programs;
    expect(programs.map((p) => p.title)).toEqual(['A', 'B']);
    expect(programs[0].stop).toBe(NOW - 2.5 * HOUR);
  });

  it('drops duplicate programmes at the same start', () => {
    const xml =
      channel('id="c"', ['C']) +
      programme('c', NOW, NOW + HOUR, '<title>A</title>') +
      programme('c', NOW, NOW + HOUR, '<title>A</title>');

    const result = parse(xml, [{ id: 'ch1', name: 'C', tvgId: 'c' }]);
    expect(result.imports[0].programs).toHaveLength(1);
    expect(result.stats.programmesSkipped).toBe(1);
  });

  it('skips and counts bad dates', () => {
    const xml =
      channel('id="c"', ['C']) +
      `<programme channel="c" start="not-a-date"><title>Bad</title></programme>`;

    const result = parse(xml, [{ id: 'ch1', name: 'C', tvgId: 'c' }]);
    expect(result.imports).toHaveLength(0);
    expect(result.stats.badDates).toBe(1);
  });

  it('applies a per-channel tvg-shift', () => {
    const xml =
      channel('id="c"', ['C']) + programme('c', NOW - HOUR, NOW + HOUR, '<title>Shifted</title>');

    const result = parse(xml, [{ id: 'ch1', name: 'C', tvgId: 'c', tvgShift: 2 }]);
    const [program] = result.imports[0].programs;
    expect(program.start).toBe(NOW - HOUR + 2 * HOUR);
    expect(program.stop).toBe(NOW + HOUR + 2 * HOUR);
  });

  it('skips programmes for unmatched channels', () => {
    const xml =
      channel('id="c"', ['C']) +
      programme('c', NOW, NOW + HOUR) +
      programme('unknown', NOW, NOW + HOUR);

    const result = parse(xml, [{ id: 'ch1', name: 'C', tvgId: 'c' }]);
    expect(result.imports[0].programs).toHaveLength(1);
    expect(result.stats.programmesSkipped).toBe(1);
  });

  it('matches a quality-tagged channel name without a tvg-id', () => {
    const xml =
      channel('id="disc"', ['Discovery HD']) +
      programme('disc', NOW, NOW + HOUR, '<title>How It Is Made</title>');

    const result = parse(xml, [{ id: 'ch2', name: 'Discovery (720p)' }]);
    expect(result.matchReport.matched).toEqual([
      { channelId: 'ch2', xmltvId: 'disc', method: 'name', confidence: 0.95 },
    ]);
    expect(result.imports[0].programs).toHaveLength(1);
  });

  it('recovers from malformed XML and counts the error', () => {
    // XMLTV lists channels before programmes; here the first programme is left
    // unclosed and a second channel forces recovery.
    const xml =
      channel('id="c"', ['C']) +
      `<programme channel="c" start="${xmltvTime(NOW)}"><title>Recovered</title>` +
      channel('id="c2"', ['C2']);
    const result = parse(xml, [{ id: 'ch1', name: 'C', tvgId: 'c' }]);
    expect(result.stats.errors).toBeGreaterThanOrEqual(1);
    expect(result.imports[0].programs[0].title).toBe('Recovered');
  });

  it('reports progress', () => {
    const progress: number[] = [];
    const xml =
      channel('id="c"', ['C']) +
      Array.from({ length: 3 }, (_, i) =>
        programme('c', NOW + i * HOUR, NOW + (i + 1) * HOUR)
      ).join('');
    parse(xml, [{ id: 'ch1', name: 'C', tvgId: 'c' }], {
      progressEvery: 1,
      onProgress: (p) => progress.push(p.programmesKept),
    });
    expect(progress.at(-1)).toBe(3);
  });

  it('produces the same result when pushed in chunks', () => {
    const xml =
      channel('id="c"', ['C']) + programme('c', NOW, NOW + HOUR, '<title>Chunked</title>');
    const options = { sourceId: 'src1', channels: [{ id: 'ch1', name: 'C', tvgId: 'c' }], now: NOW };

    const whole = parseXmltvText(`<tv>${xml}</tv>`, options);
    const parser = createXmltvParser(options);
    const full = `<tv>${xml}</tv>`;
    for (let i = 0; i < full.length; i += 5) parser.push(full.slice(i, i + 5));
    const chunked = parser.end();

    expect(chunked.imports).toEqual(whole.imports);
    expect(chunked.stats.programmesKept).toBe(whole.stats.programmesKept);
  });
});
