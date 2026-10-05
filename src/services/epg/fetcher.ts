/**
 * Streaming XMLTV download. Runs inside the parser worker (and is imported
 * directly by tests). Reports byte progress, supports AbortController cancel and
 * a timeout, detects gzip by magic bytes (never by URL alone) and classifies
 * CORS / mixed-content / timeout failures into human, credential-safe errors.
 */

import { canProxyUrl } from '../../domain/transport.ts';
import { fetchWithTransportFallback } from '../net/transportFetch.ts';

export type EpgFetchErrorKind =
  | 'cors'
  | 'mixed-content'
  | 'timeout'
  | 'aborted'
  | 'http'
  | 'gzip-unsupported'
  | 'parse'
  | 'unknown';

export class EpgFetchError extends Error {
  readonly kind: EpgFetchErrorKind;
  readonly status?: number;

  constructor(kind: EpgFetchErrorKind, message: string, status?: number) {
    super(message);
    this.name = 'EpgFetchError';
    this.kind = kind;
    this.status = status;
  }
}

export interface EpgDownloadProgress {
  bytesReceived: number;
  totalBytes?: number;
}

export interface FetchEpgStreamOptions {
  url: string;
  proxyTemplate?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  etag?: string;
  lastModified?: string;
  onProgress?: (progress: EpgDownloadProgress) => void;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
}

export interface EpgStreamResult {
  stream: ReadableStream<Uint8Array>;
  totalBytes?: number;
  etag?: string;
  lastModified?: string;
  notModified: boolean;
  usedProxy: boolean;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const GZIP_MAGIC = [0x1f, 0x8b];

function currentProtocol(): string {
  const location = (globalThis as { location?: { protocol?: string } }).location;
  return location?.protocol ?? '';
}

/** True when a plain-HTTP URL is fetched from an HTTPS page. */
export function isMixedContent(url: string): boolean {
  return currentProtocol() === 'https:' && url.startsWith('http://');
}

/** Host-only label so credentials never reach logs or error text. */
export function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'the EPG server';
  }
}

/** Replaces credential-bearing query params with `***` for display/logging. */
export function redactEpgUrl(url: string): string {
  try {
    const parsed = new URL(url);
    for (const key of ['username', 'password', 'user', 'pass']) {
      if (parsed.searchParams.has(key)) parsed.searchParams.set(key, '***');
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Magic bytes are authoritative: if they are present the payload is still
 * gzipped. `Content-Encoding`/extension are only consulted when the first two
 * bytes are unavailable, because fetch normally decodes `Content-Encoding`
 * already and decompressing again would corrupt the XML.
 */
export function shouldDecompressGzip(
  head: Uint8Array,
  contentEncoding?: string | null,
  url?: string
): boolean {
  if (head.length >= 2 && head[0] === GZIP_MAGIC[0] && head[1] === GZIP_MAGIC[1]) return true;
  if (head.length >= 2) return false;
  if (contentEncoding && /gzip/i.test(contentEncoding)) return true;
  if (url && /\.gz(\?|$)/i.test(url)) return true;
  return false;
}

export function decompressGzip(stream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new EpgFetchError(
      'gzip-unsupported',
      'This device cannot decompress gzip EPG files. Use an uncompressed XMLTV URL instead.'
    );
  }
  return stream.pipeThrough(
    new DecompressionStream('gzip') as unknown as ReadableWritablePair<Uint8Array, Uint8Array>
  );
}

export function corsMessage(url: string, proxyUsed: boolean): string {
  if (proxyUsed) {
    return `The EPG server (${safeHost(url)}) still refused the request through the proxy. Try another proxy in Settings → Network, or import the XMLTV file locally.`;
  }
  return `The EPG server (${safeHost(url)}) blocked the browser request (CORS). Enable a CORS proxy in Settings → Network, or import the XMLTV file locally.`;
}

export function mixedContentMessage(url: string): string {
  return `The EPG URL (${safeHost(url)}) is plain HTTP while this app runs on HTTPS, so the browser blocks it (mixed content). Use an HTTPS EPG URL, enable a CORS proxy, or import the file locally.`;
}

export function classifyFetchError(
  error: unknown,
  context: { timedOut: boolean; proxyUsed: boolean; url: string }
): EpgFetchError {
  if (context.timedOut) {
    return new EpgFetchError(
      'timeout',
      'The EPG download timed out. Check the URL and network, then retry.'
    );
  }
  if (error instanceof EpgFetchError) return error;
  const name = error instanceof Error ? error.name : '';
  const message = error instanceof Error ? error.message : String(error);
  if (name === 'AbortError') return new EpgFetchError('aborted', 'EPG download was cancelled.');
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(message)) {
    if (!context.proxyUsed && isMixedContent(context.url)) {
      return new EpgFetchError('mixed-content', mixedContentMessage(context.url));
    }
    return new EpgFetchError('cors', corsMessage(context.url, context.proxyUsed));
  }
  return new EpgFetchError('unknown', message || 'Unknown EPG download error.');
}

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  if (a.length === 0) return b;
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

function abortError(): Error {
  const error = new Error('Aborted');
  error.name = 'AbortError';
  return error;
}

/**
 * Reads from a stream while racing the abort signal. Fetch usually rejects a
 * pending body read when the request is aborted, but that is not guaranteed
 * once headers have arrived; without this race an idle timeout would leave the
 * worker stuck on "Downloading… 0 B" forever.
 */
function readWithAbort(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  signal?: AbortSignal
): Promise<ReadableStreamReadResult<Uint8Array>> {
  if (signal?.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(abortError());
    signal?.addEventListener('abort', onAbort, { once: true });
    reader.read().then(
      (result) => {
        signal?.removeEventListener('abort', onAbort);
        resolve(result);
      },
      (error) => {
        signal?.removeEventListener('abort', onAbort);
        reject(error);
      }
    );
  });
}

/** Reads the first `n` bytes, then re-emits them followed by the rest. */
async function peekStream(
  source: ReadableStream<Uint8Array>,
  n: number,
  signal?: AbortSignal
): Promise<{ stream: ReadableStream<Uint8Array>; head: Uint8Array }> {
  const reader = source.getReader();
  let head: Uint8Array = new Uint8Array(0);
  while (head.length < n) {
    const { done, value } = await readWithAbort(reader, signal);
    if (done) break;
    head = concatBytes(head, value);
  }
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      if (head.length > 0) controller.enqueue(head);
    },
    async pull(controller) {
      const { done, value } = await readWithAbort(reader, signal);
      if (done) controller.close();
      else controller.enqueue(value);
    },
    cancel(reason) {
      void reader.cancel(reason);
    },
  });
  return { stream, head };
}

interface CountBytesOptions {
  signal?: AbortSignal;
  onProgress?: (progress: EpgDownloadProgress) => void;
  /** Called on every chunk so the caller can reset its idle timeout. */
  onChunk?: () => void;
  /** Called when the stream closes, errors or is cancelled. */
  onSettled?: () => void;
  /** Maps a read/abort error into a user-facing error. */
  mapError?: (error: unknown) => EpgFetchError;
}

function countBytes(
  source: ReadableStream<Uint8Array>,
  totalBytes: number | undefined,
  options: CountBytesOptions
): ReadableStream<Uint8Array> {
  const { signal, onProgress, onChunk, onSettled, mapError } = options;
  const reader = source.getReader();
  let received = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await readWithAbort(reader, signal);
        if (done) {
          controller.close();
          onSettled?.();
          return;
        }
        received += value.byteLength;
        onChunk?.();
        onProgress?.({ bytesReceived: received, totalBytes });
        controller.enqueue(value);
      } catch (error) {
        onSettled?.();
        controller.error(mapError ? mapError(error) : error);
      }
    },
    cancel(reason) {
      void reader.cancel(reason);
      onSettled?.();
    },
  });
}

function parseContentLength(header: string | null): number | undefined {
  if (!header) return undefined;
  const parsed = Number.parseInt(header, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export async function fetchEpgStream(options: FetchEpgStreamOptions): Promise<EpgStreamResult> {
  const {
    url,
    proxyTemplate,
    signal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    etag,
    lastModified,
    onProgress,
  } = options;
  const fetchImpl = options.fetchImpl ?? fetch;
  const canProxy = canProxyUrl(proxyTemplate, url);

  if (!canProxy && isMixedContent(url)) {
    throw new EpgFetchError('mixed-content', mixedContentMessage(url));
  }

  const controller = new AbortController();
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  // Idle timeout: re-armed on every chunk so a large but steady download is
  // never killed, while a stalled connection fails after `timeoutMs`.
  const armTimer = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
  };
  armTimer();
  const onExternalAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) {
      if (timer) clearTimeout(timer);
      throw new EpgFetchError('aborted', 'EPG download was cancelled.');
    }
    signal.addEventListener('abort', onExternalAbort, { once: true });
  }
  const cleanup = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    signal?.removeEventListener('abort', onExternalAbort);
  };

  let response: Response;
  let usedProxy = false;
  try {
    const headers: Record<string, string> = {};
    if (etag) headers['If-None-Match'] = etag;
    if (lastModified) headers['If-Modified-Since'] = lastModified;
    // Direct first, proxy as fallback — a configured proxy must never make a
    // CORS-enabled XMLTV host unreachable (BUG-024).
    const attempt = await fetchWithTransportFallback(url, {
      proxyTemplate,
      fetchImpl,
      init: {
        signal: controller.signal,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
      },
    });
    if (!attempt.ok) {
      throw classifyFetchError(attempt.error, {
        timedOut,
        proxyUsed: attempt.usedProxy,
        url,
      });
    }
    response = attempt.response;
    usedProxy = attempt.usedProxy;
  } catch (error) {
    cleanup();
    throw error instanceof EpgFetchError
      ? error
      : classifyFetchError(error, { timedOut, proxyUsed: canProxy, url });
  }

  if (response.status === 304) {
    cleanup();
    return {
      stream: new ReadableStream<Uint8Array>({ start: (c) => c.close() }),
      notModified: true,
      etag: response.headers.get('etag') ?? etag,
      lastModified: response.headers.get('last-modified') ?? lastModified,
      usedProxy,
      totalBytes: 0,
    };
  }

  if (!response.ok) {
    cleanup();
    throw new EpgFetchError(
      'http',
      `The EPG server (${safeHost(url)}) returned HTTP ${response.status}.`,
      response.status
    );
  }

  const totalBytes = parseContentLength(response.headers.get('content-length'));
  const body =
    response.body ??
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(new ArrayBuffer(0)));
        controller.close();
      },
    });

  let peeked: ReadableStream<Uint8Array>;
  let head: Uint8Array;
  try {
    ({ stream: peeked, head } = await peekStream(body, 2, controller.signal));
  } catch (error) {
    cleanup();
    throw classifyFetchError(error, { timedOut, proxyUsed: usedProxy, url });
  }

  let decoded: ReadableStream<Uint8Array>;
  try {
    decoded = shouldDecompressGzip(head, response.headers.get('content-encoding'), url)
      ? decompressGzip(peeked)
      : peeked;
  } catch (error) {
    cleanup();
    throw error instanceof EpgFetchError
      ? error
      : classifyFetchError(error, { timedOut, proxyUsed: usedProxy, url });
  }

  return {
    stream: countBytes(decoded, totalBytes, {
      signal: controller.signal,
      onProgress,
      onChunk: armTimer,
      onSettled: cleanup,
      mapError: (error) => classifyFetchError(error, { timedOut, proxyUsed: usedProxy, url }),
    }),
    totalBytes,
    etag: response.headers.get('etag') ?? undefined,
    lastModified: response.headers.get('last-modified') ?? undefined,
    notModified: false,
    usedProxy,
  };
}

/** Reads a local `File`/`Blob` as a stream, sniffing gzip the same way. */
export async function fetchEpgFile(file: Blob): Promise<EpgStreamResult> {
  const name = (file as File).name;
  const { stream: peeked, head } = await peekStream(file.stream(), 2);
  const gzip = shouldDecompressGzip(head, undefined, name);
  return {
    stream: gzip ? decompressGzip(peeked) : peeked,
    notModified: false,
    usedProxy: false,
    totalBytes: file.size,
  };
}

export async function readStreamText(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}
