import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from './test/renderWithProviders.tsx';
import { db } from './services/storage/db.ts';
import { installDemoPlaylist } from './services/playlist/demoPlaylist.ts';
import { useSettingsStore } from './app/settingsStore.ts';
import App from './App.tsx';

// The player mounts real media engines; the shell only needs to know it is
// rendered so the rail-visibility rule can be asserted in jsdom.
vi.mock('./features/player/index.ts', async () => {
  const React = await import('react');
  return {
    PlayerView: ({ onClose }: { onClose: () => void }) =>
      React.createElement(
        'div',
        { 'data-testid': 'player-view' },
        React.createElement('button', { onClick: onClose }, 'close-player')
      ),
  };
});

async function clearDatabase() {
  await Promise.all([
    db.playlists.clear(),
    db.channels.clear(),
    db.groups.clear(),
    db.programs.clear(),
    db.history.clear(),
  ]);
}

describe('App navigation shell', () => {
  beforeEach(async () => {
    await clearDatabase();
    useSettingsStore.getState().resetSettings();
  });

  it('does not render the navigation rail during onboarding', async () => {
    renderWithProviders(<App />);

    await screen.findByRole('button', { name: /Get Started/i });
    expect(screen.queryByTestId('navigation-rail')).not.toBeInTheDocument();
  });

  it('hides the navigation rail while the fullscreen player is open', async () => {
    await installDemoPlaylist();
    renderWithProviders(<App />);

    await screen.findByText('Featured Live', undefined, { timeout: 5_000 });
    expect(screen.getByTestId('navigation-rail')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Watch Now/i }));

    await waitFor(() => expect(screen.getByTestId('player-view')).toBeInTheDocument());
    expect(screen.queryByTestId('navigation-rail')).not.toBeInTheDocument();
  });

  it('opens Live TV filtered to the clicked home category', async () => {
    await installDemoPlaylist();
    renderWithProviders(<App />);

    await screen.findByText('Featured Live', undefined, { timeout: 5_000 });

    // Clicking a category spotlight on Home must carry the group into Live TV
    // instead of dropping the selection and showing "All Channels". The group
    // name also appears on channel cards, so target the category tile's heading.
    const categoryTile = screen
      .getAllByText('Sports & Outdoors')
      .find((el) => el.tagName === 'H4');
    expect(categoryTile).toBeDefined();
    fireEvent.click(categoryTile!);

    expect(
      await screen.findByRole('heading', { name: 'Sports & Outdoors' })
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'All Channels' })).not.toBeInTheDocument();
  });

  it('shows the remote hint bar in the content footer and hides it when disabled', async () => {
    await installDemoPlaylist();
    renderWithProviders(<App />);

    await screen.findByText('Featured Live', undefined, { timeout: 5_000 });
    expect(screen.getByTestId('remote-hint-bar')).toBeInTheDocument();

    useSettingsStore.getState().updateSettings({ showRemoteHints: false });
    await waitFor(() =>
      expect(screen.queryByTestId('remote-hint-bar')).not.toBeInTheDocument()
    );
  });
});
