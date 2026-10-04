import React from 'react';
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/renderWithProviders.tsx';
import { getCurrentFocusKey } from '../../shared/focus/index.ts';
import { SearchView } from './SearchView.tsx';
import type { Channel } from '../../domain/types.ts';

function makeChannel(id: string, name: string, number: number): Channel {
  return {
    id,
    playlistId: 'pl_test',
    name,
    groupId: 'grp_test',
    groupName: 'Test Group',
    streamUrl: 'https://example.com/stream.m3u8',
    number,
    isFavorite: false,
    isHidden: false,
    isLocked: false,
  };
}

const CHANNELS: Channel[] = [
  makeChannel('c1', 'Alpha News', 1),
  makeChannel('c2', 'Beta Sports', 2),
];

describe('SearchView focus (BUG-003 regression)', () => {
  it('keeps DOM focus in the search input while typing', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <SearchView channels={CHANNELS} onSelectChannel={() => {}} onToggleFavorite={() => {}} />
    );

    const input = screen.getByPlaceholderText(/Type to search/i) as HTMLInputElement;
    input.focus();
    expect(document.activeElement).toBe(input);

    await user.type(input, 'al');

    // Result cards must not steal focus (they used to autoFocus index 0).
    // Assert both the engine focus key and DOM focus.
    expect(getCurrentFocusKey()).toBe('SEARCH_FIELD');
    expect(document.activeElement).toBe(input);
    expect(screen.getByText('Alpha News')).toBeInTheDocument();
  });
});