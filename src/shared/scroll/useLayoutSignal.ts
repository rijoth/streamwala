import { useEffect, useState } from 'react';
import type React from 'react';
import { LayoutObserverOptions, observeLayoutChanges } from './layoutObserver.ts';

/**
 * Coalesced "the layout of this element may have changed" counter.
 *
 * Returns a number that increments at most once per animation frame whenever
 * {@link observeLayoutChanges} reports a change for `targetRef`. Consumers put
 * it in an effect's dependency list to re-derive focus-anchored geometry (the
 * focus line moves with the viewport, rows above the focused one appear or
 * collapse), instead of trusting a snapshot taken at mount.
 */
export function useLayoutSignal(
  targetRef: React.RefObject<HTMLElement | null>,
  options: LayoutObserverOptions = {}
): number {
  const { subtree = false, size = true } = options;
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;
    return observeLayoutChanges(target, () => setTick((value) => value + 1), { subtree, size });
  }, [targetRef, subtree, size]);

  return tick;
}
