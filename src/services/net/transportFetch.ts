/**
 * HTTP fetches that obey the stream transport policy (ADR 023): the origin is
 * queried directly first, and the user's CORS proxy is only reached when the
 * direct attempt fails.
 *
 * Every non-player consumer of a proxy template (EPG download + detection,
 * playlist import) goes through this module, so a proxy that is down or
 * blocklisting the provider can never make a CORS-enabled origin unreachable
 * (BUG-023, BUG-024).
 */

import { applyProxyTemplate, planTransports, type PlaybackTransport } from '../../domain/transport.ts';
import { knownTransport, rememberTransport } from './transportMemory.ts';

export interface TransportFetchOptions {
  /** User-configured proxy template, e.g. `https://proxy.example/?url={url}`. */
  proxyTemplate?: string;
  /** Request init shared by every attempt (headers, credentials, …). */
  init?: RequestInit;
  /**
   * Per-attempt timeout in ms. Each attempt gets its own budget, so a direct
   * attempt that burns the clock does not starve the proxy attempt.
   */
  timeoutMs?: number;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
  /** `window.location.protocol`; defaults to the ambient one. */
  pageProtocol?: string;
}

export type TransportFetchResult =
  | { ok: true; response: Response; usedProxy: boolean; transport: PlaybackTransport }
  | {
      ok: false;
      error: unknown;
      /**
       * True when a proxied attempt was made. Callers use it to choose copy:
       * a request that also failed through the proxy is not a plain CORS error.
       */
      usedProxy: boolean;
      transport: PlaybackTransport;
      attempts: PlaybackTransport[];
    };

function ambientProtocol(): string {
  const location = (globalThis as { location?: { protocol?: string } }).location;
  return location?.protocol ?? '';
}

function abortError(): Error {
  const error = new Error('Aborted');
  error.name = 'AbortError';
  return error;
}

/**
 * Statuses that mean "this transport refused to carry the request" rather than
 * "here is your answer", so the other transport is worth one attempt.
 * 404/410 are content answers (the resource is missing on either transport),
 * and 2xx/3xx are terminal.
 */
function isTransportLevelStatus(status: number): boolean {
  return status === 401 || status === 403 || status === 407 || status === 429 || status >= 500;
}

/**
 * Composes the caller's signal with a fresh per-attempt timeout. Returning the
 * caller's signal unchanged when there is no timeout keeps `init` untouched in
 * the common case.
 */
function attemptSignal(
  caller: AbortSignal | null | undefined,
  timeoutMs: number | undefined
): AbortSignal | undefined {
  if (!timeoutMs) return caller ?? undefined;
  const timeout = AbortSignal.timeout(timeoutMs);
  if (!caller || typeof AbortSignal.any !== 'function') return caller ?? timeout;
  return AbortSignal.any([caller, timeout]);
}

/**
 * Fetches `url` over the planned transports in order.
 *
 * A transport is abandoned when the request rejects (offline, CORS, mixed
 * content, timeout) or answers with a transport-level status (401/403/407/429,
 * 5xx). The last response is returned as-is when no transport is left, so the
 * caller keeps owning HTTP status handling.
 */
export async function fetchWithTransportFallback(
  url: string,
  options: TransportFetchOptions = {}
): Promise<TransportFetchResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const transports = planTransports({
    streamUrl: url,
    proxyTemplate: options.proxyTemplate,
    pageProtocol: options.pageProtocol ?? ambientProtocol(),
    remembered: knownTransport(url),
  });

  const attempts: PlaybackTransport[] = [];
  let lastError: unknown;
  let lastTransport: PlaybackTransport = transports[0];

  for (let index = 0; index < transports.length; index += 1) {
    // Never start a fresh attempt after the caller aborted (cancel or timeout).
    if (options.init?.signal?.aborted) {
      lastError = lastError ?? abortError();
      break;
    }

    const transport = transports[index];
    const target =
      transport === 'proxied'
        ? applyProxyTemplate(options.proxyTemplate ?? '', url) ?? url
        : url;

    attempts.push(transport);
    lastTransport = transport;

    let response: Response;
    try {
      response = await fetchImpl(target, {
        ...options.init,
        signal: attemptSignal(options.init?.signal, options.timeoutMs),
      });
    } catch (error) {
      lastError = error;
      continue;
    }

    const isLast = index + 1 >= transports.length;
    if (!isLast && isTransportLevelStatus(response.status)) {
      lastError = errorForStatus(response, transport);
      continue;
    }

    rememberTransport(url, transport);
    return { ok: true, response, usedProxy: transport === 'proxied', transport };
  }

  return {
    ok: false,
    error: lastError,
    usedProxy: attempts.includes('proxied'),
    transport: lastTransport,
    attempts,
  };
}

/** Error carrying the refused attempt's status, for classification and copy. */
function errorForStatus(response: Response, transport: PlaybackTransport): Error {
  const status = `HTTP ${response.status}${response.statusText ? `: ${response.statusText}` : ''}`;
  const hint =
    transport === 'proxied' && (response.status === 429 || response.status >= 500)
      ? ' The configured CORS proxy may be down, rate-limited or blocking this provider.'
      : '';
  return new Error(`${status}.${hint}`);
}
