import { useEffect, useRef } from 'react';
import { NavAction, onNavAccelerate } from '../input/useTvInput.ts';

/**
 * Subscribes to held-key acceleration from the shared input layer.
 *
 * The spatial engine owns single-step moves; when a NAV key is held past
 * `holdAccelerateAfterMs` the input layer reports a step (1 → 2 → 4) and the
 * screen can jump that many rows. No timers or tweens are queued: the latest
 * step wins.
 */
export function useKeyRepeat(handler: (action: NavAction, step: number) => void): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(
    () => onNavAccelerate((action, step) => handlerRef.current(action, step)),
    []
  );
}
