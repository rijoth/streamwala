import { describe, expect, it } from 'vitest';
import {
  applyProxyTemplate,
  isProxiableUrl,
  planTransports,
} from './transport.ts';

/**
 * Transport policy — regression coverage for BUG-023.
 *
 * A persisted CORS proxy was applied to every stream unconditionally, so a
 * proxy that had gone down (or blocklisted the provider) broke channels whose
 * origin already returned `Access-Control-Allow-Origin`. Direct is now the
 * first transport and the proxy is a fallback.
 */

const PROXY = 'https://proxy.example.invalid/raw?url={url}';

describe('applyProxyTemplate', () => {
  it('encodes the stream URL into the token', () => {
    expect(applyProxyTemplate(PROXY, 'https://cdn.example/one.m3u8?x=1&y=2')).toBe(
      'https://proxy.example.invalid/raw?url=https%3A%2F%2Fcdn.example%2Fone.m3u8%3Fx%3D1%26y%3D2'
    );
  });

  it('rejects templates without the {url} token instead of dropping the stream URL', () => {
    expect(applyProxyTemplate('https://proxy.example.invalid/raw', 'https://cdn.example/one.m3u8')).toBeNull();
    expect(applyProxyTemplate('', 'https://cdn.example/one.m3u8')).toBeNull();
  });
});

describe('isProxiableUrl', () => {
  it('treats browser-local schemes as unproxiable', () => {
    expect(isProxiableUrl('data:application/vnd.apple.mpegurl;base64,AAAA')).toBe(false);
    expect(isProxiableUrl('blob:https://app.example/abc')).toBe(false);
    expect(isProxiableUrl('https://cdn.example/one.m3u8')).toBe(true);
  });
});

describe('planTransports', () => {
  it('attempts the origin directly when no proxy is configured', () => {
    expect(planTransports({ streamUrl: 'https://cdn.example/one.m3u8', pageProtocol: 'https:' })).toEqual([
      'direct',
    ]);
  });

  it('starts direct and falls back to the proxy when one is configured', () => {
    expect(
      planTransports({
        streamUrl: 'https://cdn.example/one.m3u8',
        proxyTemplate: PROXY,
        pageProtocol: 'https:',
      })
    ).toEqual(['direct', 'proxied']);
  });

  it('never hijacks a stream with a malformed proxy template', () => {
    expect(
      planTransports({
        streamUrl: 'https://cdn.example/one.m3u8',
        proxyTemplate: 'https://proxy.example.invalid/raw',
        pageProtocol: 'https:',
      })
    ).toEqual(['direct']);
  });

  it('never proxies data:/blob: streams', () => {
    expect(
      planTransports({
        streamUrl: 'blob:https://app.example/abc',
        proxyTemplate: PROXY,
        pageProtocol: 'https:',
      })
    ).toEqual(['direct']);
  });

  it('uses the proxy when direct playback is impossible (mixed content)', () => {
    expect(
      planTransports({
        streamUrl: 'http://cdn.example/one.ts',
        proxyTemplate: PROXY,
        pageProtocol: 'https:',
      })
    ).toEqual(['proxied']);
    // Same origin scheme on an HTTP page is not mixed content.
    expect(
      planTransports({
        streamUrl: 'http://cdn.example/one.ts',
        proxyTemplate: PROXY,
        pageProtocol: 'http:',
      })
    ).toEqual(['direct', 'proxied']);
  });

  it('prefers the transport already proven for this host in the session', () => {
    expect(
      planTransports({
        streamUrl: 'https://cdn.example/one.m3u8',
        proxyTemplate: PROXY,
        pageProtocol: 'https:',
        remembered: 'proxied',
      })
    ).toEqual(['proxied', 'direct']);
    expect(
      planTransports({
        streamUrl: 'https://cdn.example/one.m3u8',
        proxyTemplate: PROXY,
        pageProtocol: 'https:',
        remembered: 'direct',
      })
    ).toEqual(['direct', 'proxied']);
  });
});
