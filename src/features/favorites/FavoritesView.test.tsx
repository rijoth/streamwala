import React, { useState } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/renderWithProviders.tsx';
import { FavoritesView } from './FavoritesView.tsx';
import type { Channel } from '../../domain/types.ts';

// jsdom has no layout, so card focus is controlled directly. This pins the
// guard's fallback: an unpinned focused card must hand focus back to the field.
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

function makeChannel(id: string, name: string, isFavorite = true): Channel {
  return {
    id,
    playlistId: 'pl_test',
    name,
    groupId: 'grp_test',
    groupName: 'Test Group',
    streamUrl: 'https://example.invalid/stream.m3u8',
    isFavorite,
    isHidden: false,
    isLocked: false,
  };
}

const CHANNELS = [
  makeChannel('c1', 'Alpha News'),
  makeChannel('c2', 'Beta Sports'),
];

/** Stateful harness so unpinning really removes the card from the list. */
const Harness: React.FC<{ initial: Channel[] }> = ({ initial }) => {
  const [channels, setChannels] = useState(initial);
  return (
    <FavoritesView
      channels={channels}
      onSelectChannel={() => {}}
      onToggleFavorite={(id) =>
        setChannels((prev) =>
          prev.map((channel) =>
            channel.id === id ? { ...channel, isFavorite: !channel.isFavorite } : channel
          )
        )
      }
      onGoToLive={() => {}}
    />
  );
};

describe('FavoritesView inline search', () => {
  beforeEach(() => {
    focusState.current = null;
  });

  it('filters the pinned list and updates the badge', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness initial={CHANNELS} />);

    expect(screen.getByText('2 Pinned')).toBeInTheDocument();
    const input = screen.getByLabelText('Search favorites') as HTMLInputElement;
    await user.type(input, 'alpha');

    expect(screen.getByText('Alpha News')).toBeInTheDocument();
    expect(screen.queryByText('Beta Sports')).not.toBeInTheDocument();
    expect(screen.getByText('1 Match')).toBeInTheDocument();
  });

  it('returns focus to the field when a focused result is unpinned', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <Harness initial={[CHANNELS[0], makeChannel('c2', 'Beta Sports', false)]} />
    );

    const input = screen.getByLabelText('Search favorites') as HTMLInputElement;
    await user.type(input, 'alpha');
    setFocus('FAVORITES_c1');
    expect(getCurrentFocusKey()).toBe('FAVORITES_c1');

    const card = screen.getByText('Alpha News').closest('[data-channel-id]') as HTMLElement;
    fireEvent.click(card.querySelector('button') as HTMLButtonElement);

    await waitFor(() => expect(getCurrentFocusKey()).toBe('FAVORITES_SEARCH_FIELD'));
    expect(screen.queryByText('Alpha News')).not.toBeInTheDocument();
    expect(screen.getByText('No favorites pinned yet')).toBeInTheDocument();
  });

  it('shows a no-match state while favourites exist', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness initial={CHANNELS} />);

    const input = screen.getByLabelText('Search favorites') as HTMLInputElement;
    await user.type(input, 'zzz');

    expect(screen.getByText('No favorites match your search')).toBeInTheDocument();
    expect(screen.getByText('0 Match')).toBeInTheDocument();
  });

  it('keeps the browse empty state when nothing is pinned', () => {
    renderWithProviders(<Harness initial={[makeChannel('c1', 'Alpha News', false)]} />);
    expect(screen.getByText('No favorites pinned yet')).toBeInTheDocument();
    expect(screen.getByLabelText('Search favorites')).toBeInTheDocument();
  });
});
