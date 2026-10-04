import { describe, it, expect } from 'vitest';
import {
  createXmltvTokenizer,
  decodeXmlEntities,
  type XmltvRawChannel,
  type XmltvRawProgramme,
} from './xmltvTokenizer.ts';

function collect(xml: string, chunkSize = Number.POSITIVE_INFINITY) {
  const channels: XmltvRawChannel[] = [];
  const programmes: XmltvRawProgramme[] = [];
  const errors: string[] = [];
  const tokenizer = createXmltvTokenizer({
    onChannel: (c) => channels.push(c),
    onProgramme: (p) => programmes.push(p),
    onError: (m) => errors.push(m),
  });
  if (chunkSize === Number.POSITIVE_INFINITY) {
    tokenizer.push(xml);
  } else {
    for (let i = 0; i < xml.length; i += chunkSize) tokenizer.push(xml.slice(i, i + chunkSize));
  }
  tokenizer.end();
  return { channels, programmes, errors, stats: tokenizer.stats };
}

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<tv generator-info-name="test">
  <channel id="cnn.us">
    <display-name>CNN</display-name>
    <display-name>CNN US</display-name>
    <icon src="http://example.invalid/cnn.png"/>
  </channel>
  <channel id="disc">
    <display-name>Discovery &amp; Science</display-name>
  </channel>
  <programme start="20260104120000 +0000" stop="20260104130000 +0000" channel="cnn.us">
    <title lang="en">Newsroom &lt;Live&gt;</title>
    <sub-title>Midday</sub-title>
    <desc><![CDATA[All the news that fits]]></desc>
    <category>News</category>
    <rating system="MPAA">TV-PG</rating>
    <episode-num system="xmltv_ns">1.2.0/1</episode-num>
    <language>en</language>
    <icon src="http://example.invalid/prog.png"/>
  </programme>
</tv>`;

describe('xmltv tokenizer', () => {
  it('emits channels and programmes with their fields', () => {
    const { channels, programmes, stats } = collect(SAMPLE);
    expect(channels).toEqual([
      {
        id: 'cnn.us',
        displayNames: ['CNN', 'CNN US'],
        icon: 'http://example.invalid/cnn.png',
      },
      { id: 'disc', displayNames: ['Discovery & Science'], icon: undefined },
    ]);
    expect(programmes).toHaveLength(1);
    expect(programmes[0]).toMatchObject({
      channel: 'cnn.us',
      start: '20260104120000 +0000',
      stop: '20260104130000 +0000',
      title: 'Newsroom <Live>',
      subTitle: 'Midday',
      description: 'All the news that fits',
      category: 'News',
      rating: 'TV-PG',
      episodeNumber: '1.2.0/1',
      language: 'en',
      icon: 'http://example.invalid/prog.png',
    });
    expect(stats).toEqual({ channels: 2, programmes: 1, errors: 0 });
  });

  it('produces the same result when chunks split tags mid-way', () => {
    const whole = collect(SAMPLE);
    const split = collect(SAMPLE, 3);
    expect(split.channels).toEqual(whole.channels);
    expect(split.programmes).toEqual(whole.programmes);
    expect(split.stats).toEqual(whole.stats);
  });

  it('ignores comments, doctypes and a > inside an attribute value', () => {
    const xml = `<!-- <channel id="nope"> -->
<!DOCTYPE tv SYSTEM "xmltv.dtd">
<tv><channel id="a"><display-name>1 &gt; 0</display-name><icon src="x?a=1&b=2"/></channel></tv>`;
    const { channels, stats } = collect(xml);
    expect(channels).toEqual([{ id: 'a', displayNames: ['1 > 0'], icon: 'x?a=1&b=2' }]);
    expect(stats.errors).toBe(0);
  });

  it('recovers when a programme is left unclosed before a new element', () => {
    const xml = `<tv><programme channel="c1" start="20260104120000"><title>A</title><channel id="c1"><display-name>C1</display-name></channel></tv>`;
    const { channels, programmes, errors, stats } = collect(xml);
    expect(programmes).toHaveLength(1);
    expect(programmes[0].title).toBe('A');
    expect(channels).toEqual([{ id: 'c1', displayNames: ['C1'], icon: undefined }]);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(stats.errors).toBe(errors.length);
  });

  it('skips and counts channels without an id and programmes without a channel', () => {
    const xml = `<tv><channel><display-name>No id</display-name></channel><programme start="20260104120000"><title>No channel</title></programme></tv>`;
    const { channels, programmes, stats } = collect(xml);
    expect(channels).toHaveLength(0);
    expect(programmes).toHaveLength(0);
    expect(stats.errors).toBe(2);
  });

  it('keeps duplicate display names', () => {
    const xml = `<tv><channel id="d"><display-name>Same</display-name><display-name>Same</display-name></channel></tv>`;
    expect(collect(xml).channels[0].displayNames).toEqual(['Same', 'Same']);
  });

  it('decodes numeric and named entities', () => {
    expect(decodeXmlEntities('A &amp; B &#65; &#x42;')).toBe('A & B A B');
  });
});
