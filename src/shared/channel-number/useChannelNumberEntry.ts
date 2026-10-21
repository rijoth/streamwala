import { useCallback, useEffect, useRef, useState } from 'react';
import type { Channel } from '../../domain/types.ts';
import { pushBackHandler, useTvInput } from '../input/index.ts';
import { isTextEntryContextActive } from '../input/textEntryGuard.ts';
import {
  CHANNEL_NUMBER_ENTRY_CONFIG,
  channelNumberEntryAction,
  type ChannelNumberEntryAction,
} from './config.ts';

export interface UseChannelNumberEntryOptions {
  /** Full channel list, never a visible/filtered subset. */
  channels: Channel[];
  /** `NavDestination.id`, or `player` while the fullscreen player is open. */
  screen: string;
  /** Called for the `tune` action. */
  onTune: (channel: Channel) => void;
  /** Called for the `focus` action (guide row focus, no playback). */
  onFocusChannel?: (channel: Channel) => void;
  /** Hard off-switch (boot splash, onboarding, etc.). */
  disabled?: boolean;
}

export interface ChannelNumberEntryState {
  digits: string;
  message: string | null;
  action: ChannelNumberEntryAction;
}

// Read by the player so an OK that commits a number cannot also toggle its
// controls. The event listener below stops propagation for the spatial engine.
let entryActive = false;

export function isChannelNumberEntryActive(): boolean {
  return entryActive;
}

function setEntryActive(next: boolean) {
  entryActive = next;
}

/**
 * One app-level number-entry handler. Mounted once by the shell; the player and
 * every browse screen rely on it so the behaviour cannot drift per screen.
 */
export function useChannelNumberEntry({
  channels,
  screen,
  onTune,
  onFocusChannel,
  disabled = false,
}: UseChannelNumberEntryOptions): ChannelNumberEntryState {
  const action = channelNumberEntryAction(screen);
  const isEnabled = !disabled && action !== 'off';

  const [digits, setDigits] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const digitsRef = useRef('');
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the latest callbacks/data available to the event listener without
  // re-subscribing (and without stale closures) on every render.
  const channelsRef = useRef(channels);
  channelsRef.current = channels;
  const tuneRef = useRef(onTune);
  tuneRef.current = onTune;
  const focusRef = useRef(onFocusChannel);
  focusRef.current = onFocusChannel;
  const actionRef = useRef(action);
  actionRef.current = action;

  const clearTimers = useCallback(() => {
    if (commitTimerRef.current) {
      clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }
    if (messageTimerRef.current) {
      clearTimeout(messageTimerRef.current);
      messageTimerRef.current = null;
    }
  }, []);

  const clearDigits = useCallback(() => {
    if (commitTimerRef.current) {
      clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }
    digitsRef.current = '';
    setDigits('');
    setEntryActive(false);
  }, []);

  const resetEntry = useCallback(() => {
    clearTimers();
    digitsRef.current = '';
    setDigits('');
    setMessage(null);
    setEntryActive(false);
  }, [clearTimers]);

  const commit = useCallback((value: string) => {
    if (commitTimerRef.current) {
      clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }
    digitsRef.current = '';
    setDigits('');
    setEntryActive(false);
    if (!value) return;

    const number = Number.parseInt(value, 10);
    const matched = channelsRef.current.find((channel) => channel.number === number);

    if (!matched) {
      if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
      setMessage(`Channel ${number} not found`);
      messageTimerRef.current = setTimeout(() => {
        setMessage(null);
        messageTimerRef.current = null;
      }, CHANNEL_NUMBER_ENTRY_CONFIG.messageTimeoutMs);
      return;
    }

    setMessage(null);
    if (actionRef.current === 'tune') {
      tuneRef.current(matched);
    } else if (actionRef.current === 'focus') {
      focusRef.current?.(matched);
    }
  }, []);

  // Any screen change ends the current entry: a pending number must never
  // commit against the destination the viewer just left.
  useEffect(() => {
    resetEntry();
  }, [screen, resetEntry]);

  useEffect(
    () => () => {
      clearTimers();
      digitsRef.current = '';
      setEntryActive(false);
    },
    [clearTimers]
  );

  // BACK cancels an active entry through the shared back stack, so it is
  // consumed before the screen's own BACK handler can navigate away.
  useEffect(() => {
    if (!digits) return;
    return pushBackHandler(() => {
      clearDigits();
      setMessage(null);
      return true;
    });
  }, [digits, clearDigits]);

  useTvInput((event) => {
    if (!isEnabled) return;

    if (event.action === 'BACK') {
      if (!digitsRef.current) return;
      clearDigits();
      setMessage(null);
      return true;
    }

    if (event.action === 'SELECT') {
      if (!digitsRef.current) return;
      commit(digitsRef.current);
      return true;
    }

    if (event.action !== 'DIGIT' || event.digit === undefined) return;

    // Text fields, on-screen keyboards and modal sheets keep their digits.
    if (isTextEntryContextActive()) return;

    const current = digitsRef.current;
    if (current.length >= CHANNEL_NUMBER_ENTRY_CONFIG.maxDigits) return true;

    const next = current + event.digit;
    digitsRef.current = next;
    setDigits(next);
    setMessage(null);
    setEntryActive(true);

    if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
    commitTimerRef.current = setTimeout(() => {
      commitTimerRef.current = null;
      commit(digitsRef.current);
    }, CHANNEL_NUMBER_ENTRY_CONFIG.commitTimeoutMs);
    return true;
  }, [isEnabled, commit, clearDigits]);

  return { digits, message, action };
}
