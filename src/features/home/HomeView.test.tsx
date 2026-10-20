import React from 'react';
import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/renderWithProviders.tsx';
import { getCurrentFocusKey, setFocus } from '../../shared/focus/index.ts';
import { HomeView } from './HomeView.tsx';
import type { Channel } from '../../domain/types.ts';

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

const CHANNELS = [
  makeChannel('c1', 'Alpha News'),
  makeChannel('c2', 'Beta Sports'),
  makeChannel('c3', 'Gamma Kids'),
];

const noop = () => {};

describe('HomeView inline search', () => {
  it('renders the search field in the fixed header', () => {
    renderWithProviders(
      <HomeView
        channels={CHANNELS}
        groups={[]}
        onSelectChannel={noop}
        onToggleFavorite={noop}
        onGoToLive={noop}
        onGoToCategory={noop}
        onGoToGuide={noop}
      />
    );

    expect(screen.getByLabelText('Search all channels')).toBeInTheDocument();
  });

  it('replaces the hero and rows with results and restores them when cleared', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <HomeView
        channels={CHANNELS}
        groups={[]}
        onSelectChannel={noop}
        onToggleFavorite={noop}
        onGoToLive={noop}
        onGoToCategory={noop}
        onGoToGuide={noop}
      />
    );

    expect(await screen.findByText('Featured Live')).toBeInTheDocument();

    const input = screen.getByLabelText('Search all channels') as HTMLInputElement;
    await user.type(input, 'beta');

    expect(screen.queryByText('Featured Live')).not.toBeInTheDocument();
    expect(screen.getByText('Beta Sports')).toBeInTheDocument();
    expect(screen.getByText(/Found 1 matching channel/)).toBeInTheDocument();
    expect(document.activeElement).toBe(input);

    await user.clear(input);

    await waitFor(() => expect(screen.getByText('Featured Live')).toBeInTheDocument());
    expect(screen.queryByTestId('home-search-viewport')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(input);
  });

  it('keeps engine focus on the field while typing', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <HomeView
        channels={CHANNELS}
        groups={[]}
        onSelectChannel={noop}
        onToggleFavorite={noop}
        onGoToLive={noop}
        onGoToCategory={noop}
        onGoToGuide={noop}
      />
    );

    setFocus('HOME_SEARCH_FIELD');
    const input = screen.getByLabelText('Search all channels') as HTMLInputElement;
    input.focus();
    await user.type(input, 'alpha');

    expect(getCurrentFocusKey()).toBe('HOME_SEARCH_FIELD');
    expect(document.activeElement).toBe(input);
    expect(screen.getByText('Alpha News')).toBeInTheDocument();
  });
});
