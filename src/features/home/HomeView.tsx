import React from 'react';
import { Channel, Group } from '../../domain/types.ts';
import { useChannelSearch } from '../../shared/hooks/useChannelSearch.ts';
import { SearchField, SearchResultsGrid } from '../search/index.ts';
import { HomeRows } from './HomeRows.tsx';

export interface HomeViewProps {
  channels: Channel[];
  groups: Group[];
  onSelectChannel: (channel: Channel) => void;
  onToggleFavorite: (channelId: string) => void;
  onGoToLive: () => void;
  /** Go to Live TV with the given group already selected. */
  onGoToCategory: (groupId: string) => void;
  onGoToGuide: () => void;
}

/**
 * Home screen with an inline search field in a fixed header.
 *
 * While a query is active the hero and every browse row are replaced by the
 * results grid, so there is exactly one vertical scroller mounted at a time.
 * Clearing the query remounts the rows and restores the remembered offset
 * without pulling focus out of the search field.
 */
export const HomeView: React.FC<HomeViewProps> = ({
  channels,
  groups,
  onSelectChannel,
  onToggleFavorite,
  onGoToLive,
  onGoToCategory,
  onGoToGuide,
}) => {
  const { query, setQuery, isSearching, results } = useChannelSearch(channels);

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 text-[var(--md-sys-color-on-surface)]">
      <div className="shrink-0 px-8 pt-6 pb-4 border-b border-[var(--md-sys-color-outline-variant)]">
        <SearchField
          focusKey="HOME_SEARCH_FIELD"
          value={query}
          onChange={setQuery}
          label="Search all channels"
          placeholder="Search all channels by name, number or category"
          className="max-w-2xl mx-auto"
        />
      </div>

      {isSearching ? (
        <SearchResultsGrid
          channels={results}
          query={query}
          onSelectChannel={onSelectChannel}
          onToggleFavorite={onToggleFavorite}
        />
      ) : (
        <HomeRows
          channels={channels}
          groups={groups}
          onSelectChannel={onSelectChannel}
          onGoToLive={onGoToLive}
          onGoToCategory={onGoToCategory}
          onGoToGuide={onGoToGuide}
        />
      )}
    </div>
  );
};
