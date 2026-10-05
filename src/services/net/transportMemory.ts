/**
 * Session-only memory of which transport worked for a host, shared by every
 * consumer of the transport policy (player, EPG, playlist import).
 *
 * Deliberately in memory and never persisted: a transport that survived a
 * restart is exactly the failure this policy removed — a dead CORS proxy kept
 * breaking playback because the choice lived in `localStorage` (BUG-023).
 */

import type { PlaybackTransport } from '../../domain/transport.ts';

const knownTransports = new Map<string, PlaybackTransport>();

/** Host of a URL, or `null` when it is not a URL we can attribute. */
export function transportHost(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

export function knownTransport(url: string): PlaybackTransport | undefined {
  const host = transportHost(url);
  return host ? knownTransports.get(host) : undefined;
}

export function rememberTransport(url: string, transport: PlaybackTransport): void {
  const host = transportHost(url);
  if (host) knownTransports.set(host, transport);
}

/** Test hook: drop the session memory (a reload does this in production). */
export function clearTransportMemory(): void {
  knownTransports.clear();
}
