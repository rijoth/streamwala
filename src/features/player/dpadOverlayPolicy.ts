import type { PlayerManagerState } from '../../services/player/PlayerManager.ts';

/**
 * While the controls overlay or the stream-error overlay is on screen, the
 * D-pad must belong to the focus engine so users can move between overlay
 * buttons. Handling arrow and select keys in PlayerView at the same time
 * caused every arrow press to both move focus and zap channels (BUG-013).
 */
export function shouldYieldDpadToOverlay(
  showControls: boolean,
  status: PlayerManagerState['status']
): boolean {
  return showControls || status === 'error';
}