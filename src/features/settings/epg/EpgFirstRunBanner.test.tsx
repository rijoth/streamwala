import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../../test/renderWithProviders.tsx';
import type { Playlist } from '../../../domain/types.ts';
import { EpgFirstRunBanner } from './EpgFirstRunBanner.tsx';

const playlist: Playlist = {
  id: 'pl1',
  name: 'My Playlist',
  type: 'm3u',
  createdAt: 0,
  lastSyncedAt: 0,
  channelCount: 0,
  isActive: true,
};

describe('EpgFirstRunBanner', () => {
  it('prompts, and both actions are wired', () => {
    const onAddGuide = vi.fn();
    const onDismiss = vi.fn();
    renderWithProviders(
      <EpgFirstRunBanner playlist={playlist} onAddGuide={onAddGuide} onDismiss={onDismiss} />
    );

    expect(screen.getByText('Add a program guide?')).toBeInTheDocument();
    expect(screen.getByText(/My Playlist/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Add program guide'));
    expect(onAddGuide).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText('Dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
