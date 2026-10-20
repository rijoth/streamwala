import { useCallback, useMemo, useState } from 'react';
import { filterChannels } from '../../domain/channelFilter.ts';
import type { Channel } from '../../domain/types.ts';

export interface ChannelSearch {
  query: string;
  setQuery: (value: string) => void;
  clear: () => void;
  /** True once the trimmed query is non-empty. */
  isSearching: boolean;
  /** Filtered channels, or the full scope while not searching. */
  results: Channel[];
}

/**
 * Query state plus derived results for an inline channel search.
 *
 * The scope is passed in by the screen (all channels on Home, the active
 * category on Live TV, the pinned set on Favorites), so changing the scope
 * re-runs the query without any extra state.
 */
export function useChannelSearch(channels: readonly Channel[]): ChannelSearch {
  const [query, setQuery] = useState('');
  const isSearching = query.trim().length > 0;
  const results = useMemo(
    () => (isSearching ? filterChannels(channels, query) : channels.slice()),
    [channels, query, isSearching]
  );

  const clear = useCallback(() => setQuery(''), []);

  return { query, setQuery, clear, isSearching, results };
}
