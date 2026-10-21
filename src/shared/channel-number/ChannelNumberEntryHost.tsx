import React from 'react';
import type { Channel } from '../../domain/types.ts';
import { ChannelNumberOverlay } from './ChannelNumberOverlay.tsx';
import { requestGuideChannelFocus } from './guideFocus.ts';
import { useChannelNumberEntry } from './useChannelNumberEntry.ts';

export interface ChannelNumberEntryHostProps {
  channels: Channel[];
  /** `NavDestination.id`, or `player` while the player is open. */
  screen: string;
  onTune: (channel: Channel) => void;
  disabled?: boolean;
}

/**
 * Mounted once in the app shell. Owns the single number-entry listener and the
 * single overlay for the whole app, including the player.
 */
export const ChannelNumberEntryHost: React.FC<ChannelNumberEntryHostProps> = ({
  channels,
  screen,
  onTune,
  disabled = false,
}) => {
  const { digits, message } = useChannelNumberEntry({
    channels,
    screen,
    onTune,
    onFocusChannel: (channel) => {
      requestGuideChannelFocus(channel);
    },
    disabled,
  });

  return <ChannelNumberOverlay digits={digits} message={message} />;
};
