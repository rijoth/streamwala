import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import type { Channel } from '../../domain/types.ts';
import { pressKey } from '../../test/remote.ts';
import { CHANNEL_NUMBER_ENTRY_CONFIG } from './config.ts';
import { ChannelNumberEntryHost } from './ChannelNumberEntryHost.tsx';
import { registerGuideChannelFocus } from './guideFocus.ts';

function channel(number: number, isFavorite = false): Channel {
  return {
    id: `ch_${number}`,
    playlistId: 'pl1',
    name: `Channel ${number}`,
    groupId: 'g1',
    groupName: 'Group',
    streamUrl: `https://example.invalid/${number}.m3u8`,
    number,
    isFavorite,
  };
}

const channels = [channel(1, true), channel(4), channel(12, true)];

function renderHost(options: { screen?: string; onTune?: (c: Channel) => void; disabled?: boolean } = {}) {
  const onTune = options.onTune ?? vi.fn();
  const result = render(
    <ChannelNumberEntryHost
      channels={channels}
      screen={options.screen ?? 'home'}
      onTune={onTune}
      disabled={options.disabled}
    />
  );
  return { ...result, onTune };
}

function pressNumpadDigit(digit: number) {
  const event = new KeyboardEvent('keydown', { key: String(digit), bubbles: true, cancelable: true });
  Object.defineProperty(event, 'keyCode', { get: () => 96 + digit });
  act(() => {
    window.dispatchEvent(event);
  });
}

describe('ChannelNumberEntryHost', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('shows the typed digits and commits after the configured idle timeout', () => {
    const { onTune } = renderHost();

    pressKey('4');
    expect(screen.getByTestId('channel-number-overlay')).toHaveTextContent('4_');
    expect(onTune).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(CHANNEL_NUMBER_ENTRY_CONFIG.commitTimeoutMs - 1);
    });
    expect(onTune).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onTune).toHaveBeenCalledWith(expect.objectContaining({ number: 4 }));
  });

  it('commits immediately on OK/Enter, including numpad keycodes', () => {
    const { onTune } = renderHost();

    pressNumpadDigit(4);
    expect(screen.getByTestId('channel-number-overlay')).toHaveTextContent('4_');

    pressKey('Enter');
    expect(onTune).toHaveBeenCalledWith(expect.objectContaining({ number: 4 }));
    expect(screen.queryByTestId('channel-number-overlay')).not.toBeInTheDocument();
  });

  it('cancels a pending entry on BACK without tuning', () => {
    const { onTune } = renderHost();

    pressKey('1');
    pressKey('2');
    pressKey('Back');

    expect(onTune).not.toHaveBeenCalled();
    expect(screen.queryByTestId('channel-number-overlay')).not.toBeInTheDocument();
  });

  it('reports a missing channel briefly and keeps navigation untouched', () => {
    const { onTune } = renderHost();

    pressKey('9');
    pressKey('Enter');

    expect(onTune).not.toHaveBeenCalled();
    expect(screen.getByTestId('channel-number-overlay')).toHaveTextContent(
      'Channel 9 not found'
    );

    act(() => {
      vi.advanceTimersByTime(CHANNEL_NUMBER_ENTRY_CONFIG.messageTimeoutMs);
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByTestId('channel-number-overlay')).not.toBeInTheDocument();
  });

  it('routes the guide action to the focus-only handler', () => {
    const onTune = vi.fn();
    const focusHandler = vi.fn(() => true);
    const unregister = registerGuideChannelFocus(focusHandler);

    try {
      renderHost({ screen: 'guide', onTune });
      pressKey('1');
      pressKey('2');
      pressKey('Enter');

      expect(focusHandler).toHaveBeenCalledWith(expect.objectContaining({ number: 12 }));
      expect(onTune).not.toHaveBeenCalled();
    } finally {
      unregister();
    }
  });

  it('never intercepts digits while a text-entry widget or modal is open', () => {
    renderHost();

    const keyboard = document.createElement('div');
    keyboard.setAttribute('data-text-entry-open', 'true');
    document.body.appendChild(keyboard);

    try {
      pressKey('4');
      expect(screen.queryByTestId('channel-number-overlay')).not.toBeInTheDocument();
    } finally {
      keyboard.remove();
    }
  });

  it('is disabled on screens configured as off, such as Settings', () => {
    const { onTune } = renderHost({ screen: 'settings' });

    pressKey('4');
    pressKey('Enter');

    expect(screen.queryByTestId('channel-number-overlay')).not.toBeInTheDocument();
    expect(onTune).not.toHaveBeenCalled();
  });
});
