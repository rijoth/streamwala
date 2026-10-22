import type { CSSProperties } from 'react';
import { useDesignPx } from '../utils/designPx.ts';

/**
 * Clipping style for a scroll viewport whose content cannot take vertical
 * padding without breaking its index math (VirtualGrid).
 *
 * `overflow: clip` is inline so it overrides the `overflow-hidden` fallback
 * class on browsers that support it, and `overflow-clip-margin` lets the focus
 * cue (outline + 1.05 scale) paint into the focus-ring pad instead of being cut
 * off at the viewport edge. The pad is the `18 * --u` design token (ADR 035).
 *
 * The margin is resolved to a px string here on purpose: Chromium refuses
 * `overflow-clip-margin: var(...)` and `overflow-clip-margin: calc(...)` (it
 * computes to 0), so the token cannot be consumed directly. `useDesignPx`
 * re-renders the viewport on resize/scale changes, keeping the bound in sync.
 * Browsers that do not support `overflow: clip` ignore the invalid inline
 * declaration and keep the `overflow-hidden` class, so the viewport still clips.
 */
export const FOCUS_RING_PAD = 18;

export function focusRingClipStyle(designPx = 1): CSSProperties {
  return {
    overflow: 'clip',
    overflowClipMargin: `${FOCUS_RING_PAD * designPx}px`,
  } as CSSProperties;
}

export function useFocusRingClipStyle(): CSSProperties {
  return focusRingClipStyle(useDesignPx());
}
