import { describe, it, expect } from 'vitest';
import { parseM3uHeader } from './m3uParser.ts';

describe('parseM3uHeader', () => {
  it('reads url-tvg / x-tvg-url, including comma-separated lists', () => {
    const content =
      '#EXTM3U url-tvg="https://a.example.invalid/epg.xml, https://b.example.invalid/epg2.xml" x-tvg-url="https://c.example.invalid/e.xml"\n#EXTINF:-1 tvg-id="x",X\nhttp://s/x.ts';
    expect(parseM3uHeader(content).epgUrls).toEqual([
      'https://a.example.invalid/epg.xml',
      'https://b.example.invalid/epg2.xml',
      'https://c.example.invalid/e.xml',
    ]);
  });

  it('returns no suggestions when the header is absent', () => {
    expect(parseM3uHeader('#EXTINF:-1,X\nhttp://s/x.ts').epgUrls).toEqual([]);
  });

  it('handles single-quoted and unquoted values', () => {
    expect(parseM3uHeader("#EXTM3U url-tvg='https://a.example.invalid/e.xml'").epgUrls).toEqual([
      'https://a.example.invalid/e.xml',
    ]);
    expect(parseM3uHeader('#EXTM3U x-tvg-url=https://a.example.invalid/e.xml').epgUrls).toEqual([
      'https://a.example.invalid/e.xml',
    ]);
  });
});
