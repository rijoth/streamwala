import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders.tsx';
import type { Channel } from '../../domain/types.ts';

/**
 * Regression for the media Pause key: Android TV remotes send KEYCODE_MEDIA_PAUSE
 * (Chromium exposes it as the DOM `Pause` key, legacy keyCode 19) and older code
 * normalized that to NAV_UP, so the player never paused. The shared normalizer is
 * covered in keyCodes.test.ts; this mounts the real PlayerView to prove the action
 * actually reaches the player manager.
 */
const playerManager = vi.hoisted(() => ({
  pause: vi.fn(),
  play: vi.fn(),
  loadStream: vi.fn(),
  destroy: vi.fn(),
}));

vi.mock('../../services/player/PlayerManager.ts', () => ({
  PlayerManager: class {
    loadStream = playerManager.loadStream;
    destroy = playerManager.destroy;
    pause = playerManager.pause;
    play = playerManager.play;
    forceEngine = vi.fn();
    retryWithProxy = vi.fn();
    getAudioTracks = vi.fn(() => []);
    getSubtitleTracks = vi.fn(() => []);
    setAudioTrack = vi.fn();
    setSubtitleTrack = vi.fn();
  },
}));

vi.mock('../../services/storage/db.ts', () => ({
  addWatchHistory: vi.fn(),
  toggleChannelFavorite: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../services/audio/index.ts', () => ({
  playChannelSwitchSound: vi.fn(),
}));

import { PlayerView } from './PlayerView.tsx';

const channel: Channel = {
  id: 'ch1',
  playlistId: 'pl1',
  name: 'Test Channel',
  groupId: 'g1',
  groupName: 'News',
  streamUrl: 'https://example.invalid/live.m3u8',
  number: 1,
};

function renderPlayer() {
  return renderWithProviders(
    <PlayerView
      channel={channel}
      allChannels={[channel]}
      allGroups={[]}
      onChannelChange={vi.fn()}
      onClose={vi.fn()}
    />
  );
}

function pressKey(init: KeyboardEventInit) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }));
  });
}

describe('PlayerView remote transport keys', () => {
  beforeEach(() => {
    playerManager.pause.mockClear();
    playerManager.play.mockClear();
  });

  it('pauses on the DOM Pause key instead of treating it as NAV_UP', () => {
    renderPlayer();
    pressKey({ key: 'Pause' });
    expect(playerManager.pause).toHaveBeenCalledTimes(1);
  });

  it('pauses on MediaPause', () => {
    renderPlayer();
    pressKey({ key: 'MediaPause' });
    expect(playerManager.pause).toHaveBeenCalledTimes(1);
  });

  it('resumes on MediaPlay', () => {
    renderPlayer();
    pressKey({ key: 'MediaPlay' });
    expect(playerManager.play).toHaveBeenCalledTimes(1);
  });
});
