import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, act, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../../test/renderWithProviders.tsx';
import { dispatchBack } from '../../../shared/input/index.ts';
import type { Channel, Playlist } from '../../../domain/types.ts';
import { createFakeEpgRepository } from '../../../services/epg/fakeRepository.ts';
import { PlaylistEpgPanel } from './PlaylistEpgPanel.tsx';

const playlist: Playlist = {
  id: 'pl1',
  name: 'My Playlist',
  type: 'm3u',
  createdAt: 0,
  lastSyncedAt: 0,
  channelCount: 1,
  isActive: true,
};

const channels: Channel[] = [
  {
    id: 'ch1',
    playlistId: 'pl1',
    name: 'Mystery Channel',
    groupId: 'g',
    groupName: 'G',
    streamUrl: 'https://example.invalid/s.ts',
  },
];

describe('PlaylistEpgPanel', () => {
  it('shows the empty state and the match report', async () => {
    const repository = createFakeEpgRepository();
    renderWithProviders(
      <PlaylistEpgPanel
        playlist={playlist}
        channels={channels}
        repository={repository}
        onClose={vi.fn()}
      />
    );

    expect(await screen.findByText(/No EPG sources attached/)).toBeInTheDocument();
    expect(screen.getByText('Channel match report')).toBeInTheDocument();
    expect(screen.getByText('Unmatched')).toBeInTheDocument();
  });

  it('opens the mapping sheet from the match report and BACK closes it first', async () => {
    const repository = createFakeEpgRepository();
    await repository.putSource({
      id: 'src1',
      playlistId: 'pl1',
      name: 'Guide',
      kind: 'remote',
      enabled: true,
      priority: 0,
      channelCount: 1,
      programmeCount: 0,
    });
    await repository.replaceEpgChannels('src1', [
      { id: 'src1::cnn', sourceId: 'src1', playlistId: 'pl1', xmltvId: 'cnn', displayNames: ['CNN'] },
    ]);

    renderWithProviders(
      <PlaylistEpgPanel
        playlist={playlist}
        channels={channels}
        repository={repository}
        onClose={vi.fn()}
      />
    );

    expect(await screen.findByText('Guide')).toBeInTheDocument();

    fireEvent.click(await screen.findByText('Map'));
    expect(await screen.findByPlaceholderText('Channel id or name')).toBeInTheDocument();
    expect(screen.getByText('CNN')).toBeInTheDocument();

    act(() => {
      dispatchBack();
    });
    await waitFor(() =>
      expect(screen.queryByPlaceholderText('Channel id or name')).not.toBeInTheDocument()
    );
  });
});
