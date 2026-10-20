import React from 'react';
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/renderWithProviders.tsx';
import { ChannelBrowser } from './ChannelBrowser.tsx';
import type { Channel, Group } from '../../domain/types.ts';

function makeChannel(id: string, name: string, groupId: string, groupName: string): Channel {
  return {
    id,
    playlistId: 'pl_test',
    name,
    groupId,
    groupName,
    streamUrl: 'https://example.invalid/stream.m3u8',
    isFavorite: false,
    isHidden: false,
    isLocked: false,
  };
}

const NEWS = 'grp_news';
const SPORTS = 'grp_sports';

const CHANNELS: Channel[] = [
  makeChannel('c1', 'Alpha News', NEWS, 'News'),
  makeChannel('c2', 'Beta Sports', SPORTS, 'Sports'),
  makeChannel('c3', 'Gamma Sports', SPORTS, 'Sports'),
];

const GROUPS: Group[] = [
  { id: NEWS, playlistId: 'pl_test', name: 'News', type: 'live', channelCount: 1 },
  { id: SPORTS, playlistId: 'pl_test', name: 'Sports', type: 'live', channelCount: 2 },
];

const noop = () => {};

function renderBrowser(activeGroupId = 'all') {
  return renderWithProviders(
    <ChannelBrowser
      channels={CHANNELS}
      groups={GROUPS}
      activeGroupId={activeGroupId}
      onSelectGroup={noop}
      onSelectChannel={noop}
      onToggleFavorite={noop}
    />
  );
}

describe('ChannelBrowser inline search', () => {
  it('filters within the current category and reports N of M', async () => {
    const user = userEvent.setup();
    renderBrowser(NEWS);

    expect(screen.getByRole('heading', { name: 'News' })).toBeInTheDocument();
    const input = screen.getByLabelText('Search channels') as HTMLInputElement;
    await user.type(input, 'alpha');

    expect(screen.getByText('Alpha News')).toBeInTheDocument();
    expect(screen.getByText('1 of 1')).toBeInTheDocument();
    expect(screen.queryByText('Beta Sports')).not.toBeInTheDocument();
  });

  it('re-runs the query when the category scope changes', async () => {
    const user = userEvent.setup();
    const { rerender } = renderBrowser('all');

    const input = screen.getByLabelText('Search channels') as HTMLInputElement;
    await user.type(input, 'beta');
    expect(screen.getByText('Beta Sports')).toBeInTheDocument();
    expect(screen.getByText('1 of 3')).toBeInTheDocument();

    rerender(
      <ChannelBrowser
        channels={CHANNELS}
        groups={GROUPS}
        activeGroupId={SPORTS}
        onSelectGroup={noop}
        onSelectChannel={noop}
        onToggleFavorite={noop}
      />
    );

    expect(screen.getByText('Beta Sports')).toBeInTheDocument();
    expect(screen.getByText('1 of 2')).toBeInTheDocument();
    expect(screen.queryByText('Alpha News')).not.toBeInTheDocument();
  });

  it('keeps the filtered result set when toggling list/grid view', async () => {
    const user = userEvent.setup();
    renderBrowser('all');

    const input = screen.getByLabelText('Search channels') as HTMLInputElement;
    await user.type(input, 'sports');
    expect(screen.getByText('2 of 3')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /List View/i }));

    expect(screen.getByText('2 of 3')).toBeInTheDocument();
    expect(screen.getByText('Beta Sports')).toBeInTheDocument();
    expect(screen.getByText('Gamma Sports')).toBeInTheDocument();
    expect(screen.queryByText('Alpha News')).not.toBeInTheDocument();
  });

  it('shows a search-specific empty state', async () => {
    const user = userEvent.setup();
    renderBrowser('all');

    const input = screen.getByLabelText('Search channels') as HTMLInputElement;
    await user.type(input, 'zzz');

    expect(screen.getByText('No channels match your search')).toBeInTheDocument();
    expect(screen.getByText('0 of 3')).toBeInTheDocument();
    // The grid viewport stays mounted so the scroller keeps its content ref.
    expect(screen.getByTestId('live-viewport')).toBeInTheDocument();
  });
});
