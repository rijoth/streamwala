import { beforeEach, describe, expect, it } from 'vitest';
import { fetchWithTransportFallback } from './transportFetch.ts';
import { clearTransportMemory, knownTransport, rememberTransport } from './transportMemory.ts';

/**
 * Transport fallback for non-player fetches — regression coverage for BUG-024.
 *
 * The EPG download and the playlist import used to send every request through
 * the configured CORS proxy with no direct path, so a proxy that had gone down
 * failed the fetch even for a CORS-enabled host.
 */

const PROXY = 'https://proxy.example.invalid/raw?url={url}';
const ORIGIN = 'https://origin.example.invalid/epg.xml';
const PROXIED = 'https://proxy.example.invalid/raw?url=https%3A%2F%2Forigin.example.invalid%2Fepg.xml';

interface Call {
  url: string;
  signal: AbortSignal | null | undefined;
}

function originUrl(url: string): boolean {
  return url.startsWith('https://origin.example.invalid');
}

/** Records every attempt and answers from the origin/proxy handler. */
function recordingFetch(
  calls: Call[],
  handlers: { origin: () => Response | Promise<Response>; proxied: () => Response | Promise<Response> }
): typeof fetch {
  return (async (url: string, init?: RequestInit) => {
    calls.push({ url, signal: init?.signal });
    return originUrl(url) ? handlers.origin() : handlers.proxied();
  }) as unknown as typeof fetch;
}

function status(code: number): Response {
  return new Response(code === 200 ? '<tv/>' : 'nope', { status: code });
}

beforeEach(() => {
  clearTransportMemory();
});

describe('fetchWithTransportFallback', () => {
  it('queries the origin directly and never touches the proxy', async () => {
    const calls: Call[] = [];
    const result = await fetchWithTransportFallback(ORIGIN, {
      proxyTemplate: PROXY,
      fetchImpl: recordingFetch(calls, {
        origin: () => status(200),
        proxied: () => status(200),
      }),
    });

    expect(result.ok).toBe(true);
    expect(calls.map((c) => c.url)).toEqual([ORIGIN]);
    if (result.ok) {
      expect(result.usedProxy).toBe(false);
      expect(result.transport).toBe('direct');
    }
  });

  it('falls back to the proxy when the origin request is rejected', async () => {
    const calls: Call[] = [];
    const result = await fetchWithTransportFallback(ORIGIN, {
      proxyTemplate: PROXY,
      fetchImpl: recordingFetch(calls, {
        origin: () => {
          throw new TypeError('Failed to fetch');
        },
        proxied: () => status(200),
      }),
    });

    expect(result.ok).toBe(true);
    expect(calls.map((c) => c.url)).toEqual([ORIGIN, PROXIED]);
    if (result.ok) expect(result.usedProxy).toBe(true);
  });

  it('falls back on a transport-level status, not on a content status', async () => {
    const forbidden: Call[] = [];
    const denied = await fetchWithTransportFallback(ORIGIN, {
      proxyTemplate: PROXY,
      fetchImpl: recordingFetch(forbidden, {
        origin: () => status(403),
        proxied: () => status(200),
      }),
    });
    expect(forbidden).toHaveLength(2);
    expect(denied.ok).toBe(true);
    if (denied.ok) expect(denied.usedProxy).toBe(true);

    const missing: Call[] = [];
    // The 403 probe above succeeded through the proxy, which is now remembered
    // for this host; forget it so the 404 case starts direct again.
    clearTransportMemory();
    const notFound = await fetchWithTransportFallback(ORIGIN, {
      proxyTemplate: PROXY,
      fetchImpl: recordingFetch(missing, {
        origin: () => status(404),
        proxied: () => status(200),
      }),
    });
    // 404 is an answer, not a transport failure: returned to the caller as-is.
    expect(missing).toHaveLength(1);
    expect(notFound.ok).toBe(true);
    if (notFound.ok) expect(notFound.response.status).toBe(404);
  });

  it('reports usedProxy when every transport failed', async () => {
    const result = await fetchWithTransportFallback(ORIGIN, {
      proxyTemplate: PROXY,
      fetchImpl: (async () => {
        throw new TypeError('Failed to fetch');
      }) as unknown as typeof fetch,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.usedProxy).toBe(true);
      expect(result.attempts).toEqual(['direct', 'proxied']);
      expect(result.transport).toBe('proxied');
      expect(result.error).toBeInstanceOf(TypeError);
    }
  });

  it('ignores a proxy template without the {url} token', async () => {
    const calls: Call[] = [];
    const result = await fetchWithTransportFallback(ORIGIN, {
      proxyTemplate: 'https://proxy.example.invalid/raw',
      fetchImpl: recordingFetch(calls, {
        origin: () => {
          throw new TypeError('Failed to fetch');
        },
        proxied: () => status(200),
      }),
    });

    expect(calls.map((c) => c.url)).toEqual([ORIGIN]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.usedProxy).toBe(false);
  });

  it('gives every attempt its own timeout budget', async () => {
    const calls: Call[] = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      calls.push({ url, signal: init?.signal });
      if (originUrl(url)) {
        // Hangs until the per-attempt timeout aborts it, like a black-holed host.
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const error = new Error('aborted');
            error.name = 'AbortError';
            reject(error);
          });
        });
      }
      return status(200);
    }) as unknown as typeof fetch;

    const result = await fetchWithTransportFallback(ORIGIN, {
      proxyTemplate: PROXY,
      timeoutMs: 10,
      fetchImpl,
    });

    expect(calls).toHaveLength(2);
    expect(calls[0].signal?.aborted).toBe(true);
    // The proxy attempt gets a fresh budget rather than inheriting the dead one.
    expect(calls[1].signal?.aborted).toBe(false);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.usedProxy).toBe(true);
  });

  it('does not start another attempt after the caller aborted', async () => {
    const calls: Call[] = [];
    const controller = new AbortController();
    controller.abort();

    const result = await fetchWithTransportFallback(ORIGIN, {
      proxyTemplate: PROXY,
      init: { signal: controller.signal },
      fetchImpl: recordingFetch(calls, {
        origin: () => status(200),
        proxied: () => status(200),
      }),
    });

    expect(calls).toHaveLength(0);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.attempts).toEqual([]);
      expect((result.error as Error).name).toBe('AbortError');
    }
  });

  it('starts from the transport that already worked for this host', async () => {
    rememberTransport(ORIGIN, 'proxied');
    const calls: Call[] = [];

    const result = await fetchWithTransportFallback(ORIGIN, {
      proxyTemplate: PROXY,
      fetchImpl: recordingFetch(calls, {
        origin: () => status(200),
        proxied: () => status(200),
      }),
    });

    expect(calls.map((c) => c.url)).toEqual([PROXIED]);
    if (result.ok) expect(result.usedProxy).toBe(true);
  });
});

describe('transport memory', () => {
  it('attributes a remembered transport to the URL host only', () => {
    rememberTransport(ORIGIN, 'direct');
    expect(knownTransport(ORIGIN)).toBe('direct');
    expect(knownTransport('https://other.example.invalid/epg.xml')).toBeUndefined();
    expect(knownTransport('not a url')).toBeUndefined();
    expect(knownTransport('data:text/plain,x')).toBeUndefined();
  });
});
