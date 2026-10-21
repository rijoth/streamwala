import type { CSSProperties } from 'react';

/**
 * Clipping style for a scroll viewport whose content cannot take vertical
 * padding without breaking its index math (VirtualGrid).
 *
 * `overflow: clip` is inline so it overrides the `overflow-hidden` fallback
 * class on browsers that support it, and `overflow-clip-margin` lets the 3 px
 * focus ring / 1.05 scale of the first and last row paint into the focus-ring
 * pad instead of being cut off at the viewport edge. The pad token is sized for
 * that overhang (see `--focus-ring-pad` in `src/index.css`). Browsers that do not
 * support `overflow: clip` ignore the invalid inline declaration and keep the
 * `overflow-hidden` class, so the viewport still clips.
 */
export const focusRingClipStyle = {
  overflow: 'clip',
  overflowClipMargin: 'var(--focus-ring-pad)',
} as CSSProperties;
