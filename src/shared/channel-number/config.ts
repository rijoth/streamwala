/**
 * Direct channel-number entry, shared by every browse screen and the player.
 *
 * The player used to own this behaviour. It now lives here so one handler and
 * one overlay define it everywhere: the commit delay, the not-found message
 * lifetime and each screen's action are all in this object.
 */
export type ChannelNumberEntryAction = 'tune' | 'focus' | 'off';

export interface ChannelNumberEntryConfig {
  /** Idle time after the last digit before the entry commits. */
  commitTimeoutMs: number;
  /** How long "Channel N not found" stays on screen. */
  messageTimeoutMs: number;
  /** Maximum digits accepted before further presses are ignored. */
  maxDigits: number;
  /** How long the guide keeps the focus-only row highlight. */
  guideHighlightMs: number;
  /**
   * Per-destination action, keyed by `NavDestination.id` plus `player`.
   * `tune` starts playback; `focus` only moves guide focus; `off` disables
   * number entry for that screen (Settings owns text fields and dialogs).
   */
  screenActions: Record<string, ChannelNumberEntryAction>;
}

export const CHANNEL_NUMBER_ENTRY_CONFIG: ChannelNumberEntryConfig = {
  commitTimeoutMs: 1500,
  messageTimeoutMs: 2000,
  maxDigits: 4,
  guideHighlightMs: 1600,
  screenActions: {
    home: 'tune',
    live: 'tune',
    guide: 'focus',
    favorites: 'tune',
    settings: 'off',
    player: 'tune',
  },
};

export function channelNumberEntryAction(screen: string): ChannelNumberEntryAction {
  return CHANNEL_NUMBER_ENTRY_CONFIG.screenActions[screen] ?? 'off';
}
