import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, act, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders.tsx';
import { dispatchBack } from '../../shared/input/index.ts';
import type { Channel, Playlist } from '../../domain/types.ts';
import { createFakeEpgRepository } from '../../services/epg/fakeRepository.ts';
import { EpgProvider } from '../../app/epgRuntime.tsx';
import { EpgGuideView } from './EpgGuideView.tsx';
import { requestGuideChannelFocus } from '../../shared/channel-number/guideFocus.ts';

const playlist: Playlist = {
  id: 'pl1',
  name: 'Playlist',
  type: 'm3u',
  createdAt: 0,
  lastSyncedAt: 0,
  channelCount: 1,
  isActive: true,
};

const channel: Channel = {
  id: 'ch1',
  playlistId: 'pl1',
  name: 'CNN',
  groupId: 'g',
  groupName: 'News',
  streamUrl: 'https://example.invalid/s.ts',
};

function renderGuide(repository: ReturnType<typeof createFakeEpgRepository>) {
  return renderWithProviders(
    <EpgProvider playlist={playlist} channels={[channel]} repository={repository}>
      <EpgGuideView channels={[channel]} onSelectChannel={vi.fn()} />
    </EpgProvider>
  );
}

describe('EpgGuideView', () => {
  it('shows the no-guide empty state with an action', async () => {
    const repository = createFakeEpgRepository();
    const onOpenSettings = vi.fn();
    renderWithProviders(
      <EpgProvider playlist={playlist} channels={[channel]} repository={repository}>
        <EpgGuideView
          channels={[channel]}
          onSelectChannel={vi.fn()}
          onOpenSettings={onOpenSettings}
        />
      </EpgProvider>
    );

    expect(await screen.findByText('No program guide attached')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Open Settings'));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('focuses a channel row from a number-entry request without starting playback', async () => {
    const repository = createFakeEpgRepository();
    const now = Date.now();
    const second: Channel = { ...channel, id: 'ch2', name: 'BBC', number: 2 };
    await repository.putSource({
      id: 'src1',
      playlistId: 'pl1',
      name: 'Guide',
      kind: 'remote',
      enabled: true,
      priority: 0,
      lastUpdatedAt: now,
      channelCount: 2,
      programmeCount: 2,
    });
    await repository.applyProgrammeImport([
      {
        channelId: 'ch1',
        programs: [
          { id: 'p1', channelId: 'ch1', start: now - 3_600_000, stop: now + 3_600_000, title: 'Current Show' },
        ],
      },
      {
        channelId: 'ch2',
        programs: [
          { id: 'p2', channelId: 'ch2', start: now - 3_600_000, stop: now + 3_600_000, title: 'Second Show' },
        ],
      },
    ]);

    const onSelectChannel = vi.fn();
    renderWithProviders(
      <EpgProvider playlist={playlist} channels={[channel, second]} repository={repository}>
        <EpgGuideView channels={[channel, second]} onSelectChannel={onSelectChannel} />
      </EpgProvider>
    );

    expect(await screen.findByText('Second Show')).toBeInTheDocument();

    act(() => {
      expect(requestGuideChannelFocus(second)).toBe(true);
    });

    await waitFor(() => {
      const focused = document.querySelector('[data-focused="true"]');
      expect(focused).not.toBeNull();
      expect(focused).toHaveAttribute('data-channel-id', 'ch2');
    });
    expect(document.querySelector('[data-scroll-index="1"]')).toHaveAttribute(
      'data-channel-number-highlight',
      'true'
    );
    expect(onSelectChannel).not.toHaveBeenCalled();
  });

  it('renders the timeline and opens program details, with BACK closing the sheet first', async () => {
    const repository = createFakeEpgRepository();
    const now = Date.now();
    await repository.putSource({
      id: 'src1',
      playlistId: 'pl1',
      name: 'Guide',
      kind: 'remote',
      enabled: true,
      priority: 0,
      lastUpdatedAt: now,
      channelCount: 1,
      programmeCount: 1,
    });
    await repository.applyProgrammeImport([
      {
        channelId: 'ch1',
        programs: [
          { id: 'p1', channelId: 'ch1', start: now - 3_600_000, stop: now + 3_600_000, title: 'Current Show' },
        ],
      },
    ]);

    renderGuide(repository);

    expect(await screen.findByText('Current Show')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Current Show'));
    expect(await screen.findByText('Watch now')).toBeInTheDocument();

    act(() => {
      dispatchBack();
    });
    await waitFor(() => expect(screen.queryByText('Watch now')).not.toBeInTheDocument());
  });
});
