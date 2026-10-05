import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  EpgFetchError,
  fetchEpgFile,
  fetchEpgStream,
  isMixedContent,
  redactEpgUrl,
  readStreamText,
  shouldDecompressGzip,
} from './fetcher.ts';

const encoder = new TextEncoder();
const XML = '<?xml version="1.0"?><tv><channel id="a"/></tv>';

function bytes(text: string): Uint8Array {
  return encoder.encode(text);
}

function streamOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

async function gzipBytes(text: string): Promise<Uint8Array> {
  const body = new Response(text).body;
  if (!body) throw new Error('no response body');
  const compressed = body.pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(compressed).arrayBuffer());
}

function fetchReturning(body: BodyInit | null, init: ResponseInit): typeof fetch {
  return (async () => new Response(body, init)) as unknown as typeof fetch;
}

function asBody(data: Uint8Array): BodyInit {
  return data as unknown as BodyInit;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('shouldDecompressGzip', () => {
  it('trusts magic bytes above everything', () => {
    expect(shouldDecompressGzip(new Uint8Array([0x1f, 0x8b, 0x08]), undefined)).toBe(true);
  });

  it('does not double-decompress when fetch already decoded Content-Encoding', () => {
    expect(shouldDecompressGzip(bytes('<t'), 'gzip', 'https://x/epg.xml.gz')).toBe(false);
  });

  it('falls back to Content-Encoding/extension only when the head is too short', () => {
    expect(shouldDecompressGzip(new Uint8Array([0x1f]), 'gzip')).toBe(true);
    expect(shouldDecompressGzip(new Uint8Array(0), undefined, 'https://x/epg.xml.gz')).toBe(true);
    expect(shouldDecompressGzip(new Uint8Array(0), undefined, 'https://x/epg.xml')).toBe(false);
  });
});

describe('isMixedContent', () => {
  it('flags http URLs only on an https page', () => {
    vi.stubGlobal('location', { protocol: 'https:' });
    expect(isMixedContent('http://example.invalid/epg.xml')).toBe(true);
    expect(isMixedContent('https://example.invalid/epg.xml')).toBe(false);
    vi.stubGlobal('location', { protocol: 'http:' });
    expect(isMixedContent('http://example.invalid/epg.xml')).toBe(false);
  });
});

describe('fetchEpgStream', () => {
  it('streams plain XML and reports byte progress', async () => {
    const progress: number[] = [];
    const result = await fetchEpgStream({
      url: 'https://example.invalid/epg.xml',
      fetchImpl: fetchReturning(asBody(bytes(XML)), { status: 200 }),
      onProgress: (p) => progress.push(p.bytesReceived),
    });

    expect(result.notModified).toBe(false);
    expect(await readStreamText(result.stream)).toBe(XML);
    expect(progress.at(-1)).toBe(bytes(XML).byteLength);
  });

  it('decompresses gzip detected by magic bytes', async () => {
    const gz = await gzipBytes(XML);
    const result = await fetchEpgStream({
      url: 'https://example.invalid/epg.gz',
      fetchImpl: fetchReturning(asBody(gz), {
        status: 200,
        headers: { 'content-type': 'application/octet-stream' },
      }),
    });
    expect(await readStreamText(result.stream)).toBe(XML);
  });

  it('times out when the body stalls after headers', async () => {
    const stalled = new ReadableStream<Uint8Array>({ start() {} });
    const fetchImpl = (async () => new Response(stalled, { status: 200 })) as unknown as typeof fetch;

    const error = await fetchEpgStream({
      url: 'https://example.invalid/epg.gz',
      timeoutMs: 20,
      fetchImpl,
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(EpgFetchError);
    expect((error as EpgFetchError).kind).toBe('timeout');
  });

  it('does not kill a slow download that keeps making progress', async () => {
    const chunks = ['<tv>', 'abc', 'def', 'ghi', '</tv>'];
    let index = 0;
    const slow = new ReadableStream<Uint8Array>({
      async pull(controller) {
        if (index >= chunks.length) {
          controller.close();
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
        controller.enqueue(bytes(chunks[index++]));
      },
    });
    const fetchImpl = (async () => new Response(slow, { status: 200 })) as unknown as typeof fetch;

    const result = await fetchEpgStream({
      url: 'https://example.invalid/epg.xml',
      timeoutMs: 25,
      fetchImpl,
    });

    expect(await readStreamText(result.stream)).toBe('<tv>abcdefghi</tv>');
  });

  it('reports the total size when the server provides it', async () => {
    const progress: Array<{ bytesReceived: number; totalBytes?: number }> = [];
    const size = bytes(XML).byteLength;
    const result = await fetchEpgStream({
      url: 'https://example.invalid/epg.xml',
      fetchImpl: fetchReturning(asBody(bytes(XML)), {
        status: 200,
        headers: { 'content-length': String(size) },
      }),
      onProgress: (p) => progress.push(p),
    });
    await readStreamText(result.stream);
    expect(progress.at(-1)).toMatchObject({ bytesReceived: size, totalBytes: size });
  });

  it('returns notModified on a 304 and sends the validators', async () => {
    let received: HeadersInit | undefined;
    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      received = init?.headers;
      return new Response(null, { status: 304, headers: { etag: 'W/"1"' } });
    }) as unknown as typeof fetch;

    const result = await fetchEpgStream({
      url: 'https://example.invalid/epg.xml',
      etag: 'W/"1"',
      lastModified: 'Wed, 01 Jan 2026 00:00:00 GMT',
      fetchImpl,
    });

    expect(result.notModified).toBe(true);
    expect(result.etag).toBe('W/"1"');
    expect(received).toMatchObject({
      'If-None-Match': 'W/"1"',
      'If-Modified-Since': 'Wed, 01 Jan 2026 00:00:00 GMT',
    });
  });

  it('classifies a CORS failure without leaking credentials', async () => {
    const url = 'https://example.invalid/xmltv.php?username=alice&password=secret';
    const fetchImpl = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;

    const error = await fetchEpgStream({ url, fetchImpl }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(EpgFetchError);
    expect((error as EpgFetchError).kind).toBe('cors');
    expect((error as EpgFetchError).message).toContain('example.invalid');
    expect((error as EpgFetchError).message).not.toContain('secret');
    expect((error as EpgFetchError).message).not.toContain('alice');
  });

  it('classifies mixed content before attempting the request', async () => {
    vi.stubGlobal('location', { protocol: 'https:' });
    const fetchImpl = (async () => new Response(XML)) as unknown as typeof fetch;
    const error = await fetchEpgStream({ url: 'http://example.invalid/epg.xml', fetchImpl }).catch(
      (e: unknown) => e
    );
    expect((error as EpgFetchError).kind).toBe('mixed-content');
  });

  it('classifies a timeout via the abort signal', async () => {
    const fetchImpl = ((_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        });
      })) as unknown as typeof fetch;

    const error = await fetchEpgStream({
      url: 'https://example.invalid/epg.xml',
      timeoutMs: 5,
      fetchImpl,
    }).catch((e: unknown) => e);
    expect((error as EpgFetchError).kind).toBe('timeout');
  });

  it('honours an external abort', async () => {
    const controller = new AbortController();
    controller.abort();
    const error = await fetchEpgStream({
      url: 'https://example.invalid/epg.xml',
      signal: controller.signal,
      fetchImpl: fetchReturning(XML, { status: 200 }),
    }).catch((e: unknown) => e);
    expect((error as EpgFetchError).kind).toBe('aborted');
  });

  it('reports a non-OK HTTP status', async () => {
    const error = await fetchEpgStream({
      url: 'https://example.invalid/epg.xml',
      fetchImpl: fetchReturning('nope', { status: 500 }),
    }).catch((e: unknown) => e);
    expect((error as EpgFetchError).kind).toBe('http');
    expect((error as EpgFetchError).status).toBe(500);
  });
});

/**
 * BUG-024: with a proxy configured the EPG download used to be sent through it
 * unconditionally, so a dead proxy failed the refresh even for a CORS-enabled
 * XMLTV host — the same defect class as BUG-023, on the EPG surface.
 */
describe('fetchEpgStream transport policy', () => {
  const PROXY = 'https://proxy.example.invalid/raw?url={url}';
  const ORIGIN = 'https://origin.example.invalid/epg.xml';

  function recordingFetch(calls: string[], originFails: boolean): typeof fetch {
    return (async (url: string) => {
      calls.push(url);
      if (url.includes('proxy.example.invalid')) return new Response(XML, { status: 200 });
      if (originFails) throw new TypeError('Failed to fetch');
      return new Response(XML, { status: 200 });
    }) as unknown as typeof fetch;
  }

  it('fetches the origin directly even when a proxy is configured', async () => {
    const calls: string[] = [];
    const result = await fetchEpgStream({
      url: ORIGIN,
      proxyTemplate: PROXY,
      fetchImpl: recordingFetch(calls, false),
    });

    expect(calls).toEqual([ORIGIN]);
    expect(result.usedProxy).toBe(false);
    expect(await readStreamText(result.stream)).toBe(XML);
  });

  it('falls back to the proxy when the origin request is blocked', async () => {
    const calls: string[] = [];
    const result = await fetchEpgStream({
      url: ORIGIN,
      proxyTemplate: PROXY,
      fetchImpl: recordingFetch(calls, true),
    });

    expect(calls).toHaveLength(2);
    expect(calls[1]).toContain('proxy.example.invalid');
    expect(result.usedProxy).toBe(true);
    expect(await readStreamText(result.stream)).toBe(XML);
  });

  it('says the request also failed through the proxy when both transports fail', async () => {
    const error = await fetchEpgStream({
      url: ORIGIN,
      proxyTemplate: PROXY,
      fetchImpl: (async () => {
        throw new TypeError('Failed to fetch');
      }) as unknown as typeof fetch,
    }).catch((e: unknown) => e);

    expect((error as EpgFetchError).kind).toBe('cors');
    expect((error as EpgFetchError).message).toContain('through the proxy');
  });

  it('never uses a template without the {url} token', async () => {
    const calls: string[] = [];
    const error = await fetchEpgStream({
      url: ORIGIN,
      proxyTemplate: 'https://proxy.example.invalid/raw',
      fetchImpl: recordingFetch(calls, true),
    }).catch((e: unknown) => e);

    expect(calls).toEqual([ORIGIN]);
    expect((error as EpgFetchError).kind).toBe('cors');
  });
});

describe('fetchEpgFile', () => {
  it('sniffs gzip in a local file', async () => {
    const gz = await gzipBytes(XML);
    const file = {
      name: 'epg.xml.gz',
      size: gz.byteLength,
      stream: () => streamOf([gz]),
    } as unknown as File;
    const result = await fetchEpgFile(file);
    expect(await readStreamText(result.stream)).toBe(XML);
  });
});

describe('redactEpgUrl', () => {
  it('masks credential query params', () => {
    const redacted = redactEpgUrl(
      'https://example.invalid/xmltv.php?username=alice&password=secret&type=m3u'
    );
    expect(redacted).not.toContain('alice');
    expect(redacted).not.toContain('secret');
    expect(redacted).toContain('type=m3u');
  });
});
