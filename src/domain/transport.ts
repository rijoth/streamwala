/**
 * Transport policy for stream playback: whether the player fetches the origin
 * directly or the same origin through the user's CORS proxy template.
 *
 * Pure — no React, no I/O. `PlayerManager` consumes the plan; the UI consumes
 * `PlaybackTransport` for status and error copy.
 */

export type PlaybackTransport = 'direct' | 'proxied';

/** Token a proxy template must contain, e.g. `https://proxy.example/?url={url}`. */
export const PROXY_URL_TOKEN = '{url}';

/**
 * Substitutes `{url}` in a proxy template.
 *
 * Returns `null` when the template has no token. Without this guard a template
 * such as `https://proxy.example/` would silently replace every stream URL with
 * the proxy root, breaking playback on every channel with no visible cause
 * (BUG-023).
 */
export function applyProxyTemplate(template: string, url: string): string | null {
  if (!template || !template.includes(PROXY_URL_TOKEN)) return null;
  return template.replace(PROXY_URL_TOKEN, encodeURIComponent(url));
}

/** Browser-managed schemes are already local and cannot be routed through a proxy. */
export function isProxiableUrl(url: string): boolean {
  const normalized = url.trim().toLowerCase();
  return !normalized.startsWith('data:') && !normalized.startsWith('blob:');
}

export interface TransportPlanInput {
  streamUrl: string;
  proxyTemplate?: string;
  /** `window.location.protocol`, e.g. `https:`. Injected so this stays pure. */
  pageProtocol: string;
  /** Transport already proven to work for this stream host in this session. */
  remembered?: PlaybackTransport;
}

/**
 * Ordered transports to attempt for a stream.
 *
 * **Direct first.** A proxy is a fallback, never an assumption: public proxies
 * are routinely rate-limited, blocklisted by providers, or simply down, and a
 * dead proxy must not be able to break a stream whose origin already serves
 * `Access-Control-Allow-Origin` (BUG-023). The proxy is only reached when the
 * direct attempt fails with a network/CORS error.
 *
 * Exception — mixed content: an `http://` stream on an `https://` page is
 * blocked by the browser before any request is made, so the proxy is the only
 * viable transport and is attempted first (and only).
 */
export function planTransports(input: TransportPlanInput): PlaybackTransport[] {
  const url = input.streamUrl.trim();
  if (!input.proxyTemplate || !isProxiableUrl(url)) return ['direct'];
  if (!applyProxyTemplate(input.proxyTemplate, url)) return ['direct'];
  if (input.pageProtocol === 'https:' && /^http:\/\//i.test(url)) return ['proxied'];
  return input.remembered === 'proxied' ? ['proxied', 'direct'] : ['direct', 'proxied'];
}
