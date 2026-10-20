import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/renderWithProviders.tsx';
import { useChannelSearch } from '../../shared/hooks/useChannelSearch.ts';
import { SearchField } from './SearchField.tsx';
import { SearchResultsGrid } from './SearchResultsGrid.tsx';
import type { Channel } from '../../domain/types.ts';

// jsdom has no layout, so the real engine cannot target a zero-sized card. The
// focus key is controlled directly here; the guard's own behaviour (fallback,
// survivor re-anchor, offset clamp) is what this suite pins.
const focusState = vi.hoisted(() => ({ current: null as string | null }));

vi.mock('../../shared/focus/index.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../shared/focus/index.ts')>();
  return {
    ...actual,
    getCurrentFocusKey: () => focusState.current,
    setFocus: vi.fn((key: string) => {
      focusState.current = key;
    }),
  };
});

import { getCurrentFocusKey, setFocus } from '../../shared/focus/index.ts';

function makeChannel(id: string, name: string, groupName = 'Test Group'): Channel {
  return {
    id,
    playlistId: 'pl_test',
    name,
    groupId: `grp_${groupName}`,
    groupName,
    streamUrl: 'https://example.invalid/stream.m3u8',
    isFavorite: false,
    isHidden: false,
    isLocked: false,
  };
}

const Harness: React.FC<{ channels: Channel[] }> = ({ channels }) => {
  const { query, setQuery, isSearching, results } = useChannelSearch(channels);
  return (
    <div>
      <SearchField focusKey="HOME_SEARCH_FIELD" value={query} onChange={setQuery} />
      {isSearching ? (
        <SearchResultsGrid
          channels={results}
          query={query}
          onSelectChannel={() => {}}
          onToggleFavorite={() => {}}
        />
      ) : (
        <div data-testid="browse-rows" />
      )}
    </div>
  );
};

const CHANNELS = [
  makeChannel('c1', 'Alpha News'),
  makeChannel('c2', 'Beta Sports'),
  makeChannel('c3', 'Beta Movies'),
];

describe('SearchResultsGrid focus guard', () => {
  beforeEach(() => {
    focusState.current = 'HOME_SEARCH_FIELD';
  });

  it('never auto-focuses a result card', () => {
    renderWithProviders(<Harness channels={CHANNELS} />);
    expect(getCurrentFocusKey()).not.toMatch(/^HOME_SEARCH_RESULT_/);
  });

  it('keeps engine and DOM focus on the field while typing (BUG-003)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness channels={CHANNELS} />);

    const input = screen.getByLabelText('Search channels') as HTMLInputElement;
    input.focus();
    await user.type(input, 'beta');

    expect(getCurrentFocusKey()).toBe('HOME_SEARCH_FIELD');
    expect(document.activeElement).toBe(input);
    expect(screen.getByText('Beta Sports')).toBeInTheDocument();
  });

  it('returns focus to the field when the focused result stops matching', async () => {
    const user = userEvent.setup();
    const { rerender } = renderWithProviders(<Harness channels={CHANNELS} />);

    const input = screen.getByLabelText('Search channels') as HTMLInputElement;
    input.focus();
    await user.type(input, 'beta');
    expect(screen.getByText('Beta Sports')).toBeInTheDocument();

    setFocus('HOME_SEARCH_RESULT_c2');
    expect(getCurrentFocusKey()).toBe('HOME_SEARCH_RESULT_c2');

    rerender(<Harness channels={[CHANNELS[0], CHANNELS[2]]} />);

    await waitFor(() => expect(getCurrentFocusKey()).toBe('HOME_SEARCH_FIELD'));
    expect(screen.queryByText('Beta Sports')).not.toBeInTheDocument();
    expect(screen.getByText('Beta Movies')).toBeInTheDocument();
  });

  it('keeps a surviving card mounted and clamps the offset when the list shrinks', async () => {
    const user = userEvent.setup();
    const { rerender } = renderWithProviders(<Harness channels={CHANNELS} />);

    const input = screen.getByLabelText('Search channels') as HTMLInputElement;
    input.focus();
    await user.type(input, 'beta');

    const survivorBefore = screen.getByText('Beta Movies').closest('[data-channel-id]');
    expect(survivorBefore).not.toBeNull();

    // Re-anchor as if the survivor card kept focus, then shrink the result set.
    setFocus('HOME_SEARCH_RESULT_c3');
    rerender(<Harness channels={[...CHANNELS]} />);
    rerender(<Harness channels={[CHANNELS[0], CHANNELS[2]]} />);

    // One surviving match (1 column in jsdom) ⇒ content height is one row
    // (168 px fallback item + 16 px gap) and the stale offset clamps to 0.
    await waitFor(() => {
      const viewport = screen.getByTestId('home-search-viewport');
      expect(Number(viewport.dataset.scrollContentSize)).toBe(184);
      expect(Number(viewport.dataset.scrollOffset)).toBe(0);
    });

    const survivorAfter = screen.getByText('Beta Movies').closest('[data-channel-id]');
    expect(survivorAfter).toBe(survivorBefore);
    expect(getCurrentFocusKey()).toBe('HOME_SEARCH_RESULT_c3');
  });

  it('shows the empty state without unmounting the grid', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness channels={CHANNELS} />);

    const input = screen.getByLabelText('Search channels') as HTMLInputElement;
    input.focus();
    await user.type(input, 'zzz');

    expect(screen.getByText(/No channels match/)).toBeInTheDocument();
    expect(screen.getByTestId('home-search-viewport')).toBeInTheDocument();
  });
});
