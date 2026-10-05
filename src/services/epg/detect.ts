/**
 * EPG auto-detection. Produces suggestions only — the UI must ask the user
 * before fetching an unknown host, so nothing here writes or silently attaches.
 */

import type { EpgSourceKind, Playlist, XtreamCredentials } from '../../domain/types.ts';
import { parseM3uHeader, type M3uHeaderInfo } from '../playlist/m3uParser.ts';
import { canProxyUrl } from '../../domain/transport.ts';
import { fetchWithTransportFallback } from '../net/transportFetch.ts';
import {
  EpgFetchError,
  classifyFetchError,
  isMixedContent,
  mixedContentMessage,
} from './fetcher.ts';

export interface EpgSuggestion {
  url: string;
  kind: EpgSourceKind;
  label: string;
}

export interface DetectEpgOptions {
  proxyTemplate?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxHeaderBytes?: number;
}

/** Derives the Xtream XMLTV URL from the server + credentials. */
export function xtreamEpgUrl(creds: XtreamCredentials): string {
  const server = creds.serverUrl.trim().replace(/\/+$/, '');
  const base = /^https?:\/\//i.test(server) ? server : `http://${server}`;
  return `${base}/xmltv.php?username=${encodeURIComponent(creds.username)}&password=${encodeURIComponent(creds.password)}`;
}

async function readPrefix(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder();
  let text = '';
  let bytes = 0;
  while (bytes < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    text += decoder.decode(value, { stream: true });
    if (text.includes('\n')) break;
  }
  void reader.cancel();
  return text;
}

async function fetchM3uHeader(url: string, options: DetectEpgOptions): Promise<M3uHeaderInfo> {
  const { proxyTemplate, fetchImpl = fetch, timeoutMs = 15_000, maxHeaderBytes = 8192 } = options;
  if (!canProxyUrl(proxyTemplate, url) && isMixedContent(url)) {
    throw new EpgFetchError('mixed-content', mixedContentMessage(url));
  }
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    // Direct first, proxy as fallback (BUG-024).
    const attempt = await fetchWithTransportFallback(url, {
      proxyTemplate,
      fetchImpl,
      init: { signal: controller.signal },
    });
    if (!attempt.ok) {
      throw classifyFetchError(attempt.error, {
        timedOut,
        proxyUsed: attempt.usedProxy,
        url,
      });
    }
    const { response } = attempt;
    if (!response.ok) {
      throw new EpgFetchError('http', `HTTP ${response.status}`, response.status);
    }
    const text = await readPrefix(response, maxHeaderBytes);
    return parseM3uHeader(text);
  } catch (error) {
    throw error instanceof EpgFetchError
      ? error
      : classifyFetchError(error, { timedOut, proxyUsed: canProxyUrl(proxyTemplate, url), url });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Returns one-tap EPG suggestions for a playlist: the derived Xtream URL, or
 * the `url-tvg`/`x-tvg-url` values read from the M3U header.
 */
export async function detectEpgSources(
  playlist: Playlist,
  options: DetectEpgOptions = {}
): Promise<EpgSuggestion[]> {
  if (playlist.type === 'xtream' && playlist.xtream) {
    return [
      {
        url: xtreamEpgUrl(playlist.xtream),
        kind: 'xtream',
        label: 'Xtream XMLTV (xmltv.php)',
      },
    ];
  }

  if ((playlist.type === 'm3u' || playlist.type === 'file') && playlist.url) {
    const header = await fetchM3uHeader(playlist.url, options);
    return header.epgUrls.map((url) => ({
      url,
      kind: 'remote' as const,
      label: 'From playlist header (url-tvg)',
    }));
  }

  return [];
}
