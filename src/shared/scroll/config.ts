/**
 * Scroll configuration tokens.
 *
 * All values are plain numbers so the offset math in `math.ts` stays pure and
 * unit-testable. Screens may override individual values; anything not supplied
 * falls back to {@link DEFAULT_SCROLL_CONFIG}.
 */
export interface ScrollConfig {
  /** Fraction of the viewport height at which a focused row is anchored (0-1). */
  focusLine: number;
  /** Pixels of the next row left visible below the focus line as an affordance. */
  rowPeek: number;
  /** Items between the focused item and the viewport edge that trigger a scroll. */
  edgeMargin: number;
  /** Animation duration in milliseconds. */
  duration: number;
  /** Minimum gap between accepted held-key moves in milliseconds. */
  repeatThrottleMs: number;
  /** Hold duration after which the repeat step accelerates. */
  holdAccelerateAfterMs: number;
  /** Maximum rows moved per accelerated repeat step. */
  maxRepeatStep: number;
  /** Leading card slots kept fixed before a horizontal strip starts to slide. */
  carouselSlot: number;
  /** Extra rows rendered outside the visible range by the windowing primitive. */
  overscanRows: number;
  /** Allowed drift (fraction of a row) when asserting the focus-line band. */
  focusLineTolerance: number;
}

export const DEFAULT_SCROLL_CONFIG: ScrollConfig = {
  focusLine: 0.38,
  rowPeek: 64,
  edgeMargin: 1,
  duration: 220,
  repeatThrottleMs: 90,
  holdAccelerateAfterMs: 500,
  maxRepeatStep: 4,
  carouselSlot: 1,
  overscanRows: 2,
  focusLineTolerance: 0.6,
};

/** Merges a partial override onto the defaults. */
export function resolveScrollConfig(partial?: Partial<ScrollConfig>): ScrollConfig {
  return partial ? { ...DEFAULT_SCROLL_CONFIG, ...partial } : DEFAULT_SCROLL_CONFIG;
}
