/**
 * Pure channel-query matching used by the per-screen search fields.
 *
 * No React and no I/O: the inline search on Home, Live TV and Favorites must
 * agree on what "matches" means, so the rule lives here and is unit-tested
 * independently of the screens.
 */
import type { Channel } from './types.ts';

/** Lower-cased, trimmed query. A blank query matches everything. */
export function normalizeChannelQuery(query: string): string {
  return query.trim().toLowerCase();
}

/** True when the channel matches `query` on name, group name or number. */
export function matchesChannelQuery(channel: Channel, query: string): boolean {
  const normalized = normalizeChannelQuery(query);
  if (!normalized) return true;

  if (channel.name.toLowerCase().includes(normalized)) return true;
  if (channel.groupName && channel.groupName.toLowerCase().includes(normalized)) return true;
  if (
    typeof channel.number === 'number' &&
    !Number.isNaN(channel.number) &&
    String(channel.number).includes(normalized)
  ) {
    return true;
  }
  return false;
}

/**
 * Filter channels by `query`, preserving input order.
 *
 * A blank query returns every channel (a copy, so callers never mutate the
 * source list). Matching is case-insensitive across the channel name, its
 * group name and a partial channel number.
 */
export function filterChannels(channels: readonly Channel[], query: string): Channel[] {
  const normalized = normalizeChannelQuery(query);
  if (!normalized) return channels.slice();
  return channels.filter((channel) => matchesChannelQuery(channel, normalized));
}
