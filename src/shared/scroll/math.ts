/**
 * Pure offset math for the focus-driven scrolling system.
 *
 * No React and no DOM: every function here is deterministic and exhaustively
 * unit-tested in `math.test.ts`. Offsets are derived from `index × item size`
 * plus known headers/gaps, never from `getBoundingClientRect` in the hot path.
 */
import { ScrollConfig } from './config.ts';

export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

/** Largest valid scroll offset for a content/viewport pair. */
export function maxOffset(contentSize: number, viewportSize: number): number {
  return Math.max(0, contentSize - viewportSize);
}

/** Pixel position of the focus line inside the viewport. */
export function focusLineOffset(viewportSize: number, config: ScrollConfig): number {
  return viewportSize * config.focusLine;
}

/** Sum of the sizes of the rows before `rowIndex`. */
export function rowPrefixOffset(rowSizes: number[], rowIndex: number): number {
  let total = 0;
  const last = Math.min(Math.max(rowIndex, 0), rowSizes.length);
  for (let i = 0; i < last; i += 1) total += rowSizes[i] ?? 0;
  return total;
}

/**
 * Row-snap offset: the focused row's top is anchored at the focus line.
 * Clamped so the top of the list is never overscrolled; the last rows may
 * rest at the bottom instead of reaching the focus line when the content is
 * shorter than `viewport + focusLine`.
 */
export function rowSnapOffset(
  rowTop: number,
  viewportSize: number,
  contentSize: number,
  config: ScrollConfig
): number {
  return clamp(rowTop - focusLineOffset(viewportSize, config), 0, maxOffset(contentSize, viewportSize));
}

/**
 * Horizontal carousel offset. The focused card stays in slot
 * `config.carouselSlot` (0-based from the leading edge) once it has passed that
 * slot; before then the strip does not move.
 */
export function carouselOffset(
  activeIndex: number,
  cardSize: number,
  gap: number,
  viewportSize: number,
  contentSize: number,
  config: ScrollConfig
): number {
  const step = cardSize + gap;
  const lead = Math.max(0, activeIndex - config.carouselSlot);
  return clamp(lead * step, 0, maxOffset(contentSize, viewportSize));
}

/** Number of whole columns that fit in a width. */
export function gridColumns(
  viewportWidth: number,
  itemWidth: number,
  gap: number,
  maxColumns = 8
): number {
  if (itemWidth <= 0) return 1;
  const columns = Math.floor((viewportWidth + gap) / (itemWidth + gap));
  return clamp(columns, 1, maxColumns);
}

/** Number of rows a grid needs for `count` items. */
export function gridRows(count: number, columns: number): number {
  if (columns <= 0) return 0;
  return Math.ceil(count / columns);
}

/** Row index for a flat grid/list index. */
export function rowForIndex(index: number, columns: number): number {
  if (columns <= 0) return 0;
  return Math.floor(index / columns);
}

/** Column index for a flat grid/list index. */
export function columnForIndex(index: number, columns: number): number {
  if (columns <= 0) return 0;
  return ((index % columns) + columns) % columns;
}

/**
 * Minimal-scroll offset for grids and long lists.
 *
 * Does nothing while focus is comfortably inside the viewport. When the focused
 * row is within `edgeMargin` rows of either edge, it scrolls exactly enough to
 * restore the margin. Edge-triggered, so there is no constant motion.
 */
export function minimalScrollOffset(
  currentOffset: number,
  rowIndex: number,
  rowSize: number,
  viewportSize: number,
  contentSize: number,
  config: ScrollConfig
): number {
  const max = maxOffset(contentSize, viewportSize);
  const visibleRows = Math.max(1, Math.floor(viewportSize / rowSize));
  const firstVisible = Math.floor(currentOffset / rowSize);
  const lastVisible = firstVisible + visibleRows - 1;

  let target = currentOffset;
  if (rowIndex - firstVisible < config.edgeMargin) {
    target = (rowIndex - config.edgeMargin) * rowSize;
  } else if (lastVisible - rowIndex < config.edgeMargin) {
    target = (rowIndex - (visibleRows - 1 - config.edgeMargin)) * rowSize;
  }
  return clamp(target, 0, max);
}

/** Inclusive/exclusive visible item range with overscan, for windowing. */
export function visibleRange(
  offset: number,
  viewportSize: number,
  itemSize: number,
  count: number,
  overscan: number
): { start: number; end: number } {
  if (itemSize <= 0 || count <= 0) return { start: 0, end: 0 };
  const first = Math.floor(offset / itemSize) - overscan;
  const last = Math.ceil((offset + viewportSize) / itemSize) + overscan;
  return { start: clamp(first, 0, count), end: clamp(last, 0, count) };
}

/** Whether an offset places `rowTop` inside the focus-line band. */
export function isRowAtFocusLine(
  offset: number,
  rowTop: number,
  rowSize: number,
  viewportSize: number,
  contentSize: number,
  config: ScrollConfig
): boolean {
  const band = focusLineOffset(viewportSize, config);
  const tolerance = rowSize * config.focusLineTolerance;
  if (Math.abs(rowTop - offset - band) <= tolerance) return true;
  // Clamped top: the row sits above the focus line and the list cannot scroll.
  if (rowTop - band <= 0 && offset <= 0.5) return true;
  // Clamped bottom: the row rests at the maximum offset.
  const max = maxOffset(contentSize, viewportSize);
  return rowTop + rowSize > contentSize && Math.abs(offset - max) <= 0.5;
}

/** Rows moved per accelerated repeat step after the hold threshold. */
export function repeatStep(heldMs: number, config: ScrollConfig): number {
  if (heldMs < config.holdAccelerateAfterMs) return 1;
  const doublings = 1 + Math.floor((heldMs - config.holdAccelerateAfterMs) / config.holdAccelerateAfterMs);
  return clamp(2 ** doublings, 1, config.maxRepeatStep);
}

/** True when a repeat arriving at `now` is inside the throttle window. */
export function shouldBlockRepeat(lastAcceptedAt: number, now: number, config: ScrollConfig): boolean {
  return now - lastAcceptedAt < config.repeatThrottleMs;
}

/** Standard cubic-bezier easing curve, evaluated on the x axis. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const sampleDx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

  return (x: number) => {
    const tx = clamp(x, 0, 1);
    let lo = 0;
    let hi = 1;
    let t = tx;
    for (let i = 0; i < 8; i += 1) {
      const dx = sampleX(t) - tx;
      if (Math.abs(dx) < 1e-5) return sampleY(t);
      const slope = sampleDx(t);
      if (Math.abs(slope) < 1e-6) break;
      t -= dx / slope;
    }
    // Bisection fallback keeps the function monotonic and bounded.
    lo = 0;
    hi = 1;
    t = tx;
    for (let i = 0; i < 24; i += 1) {
      const x = sampleX(t);
      if (Math.abs(x - tx) < 1e-5) break;
      if (x < tx) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return sampleY(t);
  };
}

/** Material 3 emphasized-decelerate curve. */
export const emphasizedDecelerate = cubicBezier(0.05, 0.7, 0.1, 1);

/** Linear interpolation between two values. */
export function interpolate(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

export interface TweenState {
  from: number;
  to: number;
  startTime: number;
  duration: number;
}

export interface TweenStep {
  value: number;
  done: boolean;
}

/** Advances a tween to `now`, returning the eased value and completion flag. */
export function stepTween(
  state: TweenState,
  now: number,
  easing: (t: number) => number = emphasizedDecelerate
): TweenStep {
  if (state.duration <= 0) return { value: state.to, done: true };
  const progress = clamp((now - state.startTime) / state.duration, 0, 1);
  if (progress >= 1) return { value: state.to, done: true };
  return { value: interpolate(state.from, state.to, easing(progress)), done: false };
}

/**
 * Retargets a tween mid-flight. The current eased value becomes the new origin
 * so motion continues from where it is, and the latest target always wins.
 */
export function retargetTween(
  state: TweenState,
  newTo: number,
  now: number,
  duration?: number,
  easing: (t: number) => number = emphasizedDecelerate
): TweenState {
  const current = stepTween(state, now, easing).value;
  return {
    from: current,
    to: newTo,
    startTime: now,
    duration: duration ?? state.duration,
  };
}
