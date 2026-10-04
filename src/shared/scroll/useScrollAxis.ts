import { useCallback, useEffect, useRef } from 'react';
import type React from 'react';
import { ScrollConfig, resolveScrollConfig } from './config.ts';
import { clamp, maxOffset, retargetTween, stepTween, TweenState } from './math.ts';

export type ScrollOrientation = 'vertical' | 'horizontal';

/** True when the user asked the OS to reduce motion. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export interface UseScrollAxisOptions {
  orientation: ScrollOrientation;
  config?: Partial<ScrollConfig>;
}

/**
 * Transform-based scroll axis primitive.
 *
 * The viewport clips; the content is moved with `translate3d` only. Offsets are
 * driven explicitly by {@link ScrollAxisApi.scrollToOffset} (the focus layer) or
 * by wheel/touch input, which feed the *same* model. A new target retargets the
 * in-flight rAF tween instead of queuing, so held keys never stack animations.
 */
export interface ScrollAxisApi {
  orientation: ScrollOrientation;
  viewportRef: React.RefObject<HTMLDivElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
  getOffset(): number;
  getContentSize(): number;
  getViewportSize(): number;
  setSizes(contentSize: number, viewportSize: number): void;
  /** Applies an offset once the viewport has a non-zero size (restore path). */
  setPendingOffset(offset: number): void;
  /** Runs `callback` once the viewport size is known. */
  onSized(callback: () => void): () => void;
  isSized(): boolean;
  scrollToOffset(target: number, opts?: { animate?: boolean }): void;
  scrollBy(delta: number): void;
  subscribe(listener: (offset: number) => void): () => void;
  isAnimating(): boolean;
}

export function useScrollAxis({ orientation, config }: UseScrollAxisOptions): ScrollAxisApi {
  const cfgRef = useRef<ScrollConfig>(resolveScrollConfig(config));
  cfgRef.current = resolveScrollConfig(config);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const offsetRef = useRef(0);
  const contentSizeRef = useRef(0);
  const viewportSizeRef = useRef(0);
  const tweenRef = useRef<TweenState | null>(null);
  const rafRef = useRef<number | null>(null);
  const listenersRef = useRef(new Set<(offset: number) => void>());
  const pendingOffsetRef = useRef<number | null>(null);
  const sizedRef = useRef(false);
  const sizedListenersRef = useRef(new Set<() => void>());

  const apply = useCallback(() => {
    const offset = offsetRef.current;
    const content = contentRef.current;
    if (content) {
      content.style.transform =
        orientation === 'vertical'
          ? `translate3d(0, ${-offset}px, 0)`
          : `translate3d(${-offset}px, 0, 0)`;
    }
    const viewport = viewportRef.current;
    if (viewport) {
      viewport.dataset.scrollOffset = String(Math.round(offset));
      viewport.dataset.scrollContentSize = String(Math.round(contentSizeRef.current));
      viewport.dataset.scrollViewportSize = String(Math.round(viewportSizeRef.current));
    }
    listenersRef.current.forEach((listener) => listener(offset));
  }, [orientation]);

  const applyClamped = useCallback(
    (value: number) => {
      const max = maxOffset(contentSizeRef.current, viewportSizeRef.current);
      offsetRef.current = clamp(value, 0, max);
      apply();
      return offsetRef.current;
    },
    [apply]
  );

  const stopTween = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    tweenRef.current = null;
  }, []);

  const tick = useCallback(
    (now: number) => {
      const tween = tweenRef.current;
      if (!tween) {
        rafRef.current = null;
        return;
      }
      const { value, done } = stepTween(tween, now);
      applyClamped(value);
      if (done) {
        tweenRef.current = null;
        rafRef.current = null;
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    },
    [applyClamped]
  );

  const scrollToOffset = useCallback(
    (target: number, opts?: { animate?: boolean }) => {
      const cfg = cfgRef.current;
      pendingOffsetRef.current = null;
      const max = maxOffset(contentSizeRef.current, viewportSizeRef.current);
      const clamped = clamp(target, 0, max);
      const animate = opts?.animate ?? true;

      if (!animate || cfg.duration <= 0 || prefersReducedMotion()) {
        stopTween();
        applyClamped(clamped);
        return;
      }

      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (tweenRef.current) {
        tweenRef.current = retargetTween(tweenRef.current, clamped, now, cfg.duration);
      } else {
        tweenRef.current = {
          from: offsetRef.current,
          to: clamped,
          startTime: now,
          duration: cfg.duration,
        };
      }
      if (rafRef.current === null) rafRef.current = requestAnimationFrame(tick);
    },
    [applyClamped, stopTween, tick]
  );

  const scrollBy = useCallback(
    (delta: number) => {
      scrollToOffset(offsetRef.current + delta, { animate: false });
    },
    [scrollToOffset]
  );

  const setSizes = useCallback(
    (contentSize: number, viewportSize: number) => {
      contentSizeRef.current = Math.max(0, contentSize);
      viewportSizeRef.current = Math.max(0, viewportSize);
      if (viewportSize > 0 && !sizedRef.current) {
        sizedRef.current = true;
        sizedListenersRef.current.forEach((listener) => listener());
      }
      const pending = pendingOffsetRef.current;
      pendingOffsetRef.current = null;
      applyClamped(pending ?? offsetRef.current);
    },
    [applyClamped]
  );

  const setPendingOffset = useCallback(
    (offset: number) => {
      stopTween();
      if (sizedRef.current) {
        applyClamped(offset);
      } else {
        pendingOffsetRef.current = offset;
      }
    },
    [applyClamped, stopTween]
  );

  const onSized = useCallback((callback: () => void) => {
    if (sizedRef.current) {
      callback();
      return () => undefined;
    }
    sizedListenersRef.current.add(callback);
    return () => {
      sizedListenersRef.current.delete(callback);
    };
  }, []);

  const subscribe = useCallback((listener: (offset: number) => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  // Wheel + touch feed the same offset model. Native listeners are used so
  // `wheel`/`touchmove` can be non-passive and `preventDefault` is allowed.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const onWheel = (event: WheelEvent) => {
      const primary = orientation === 'vertical' ? event.deltaY : event.deltaX;
      const secondary = orientation === 'vertical' ? event.deltaX : event.deltaY;
      // Only own the gesture when this axis dominates; otherwise let it bubble
      // to the parent axis (e.g. a vertical wheel over a horizontal carousel).
      if (primary === 0 || Math.abs(primary) <= Math.abs(secondary)) return;
      event.preventDefault();
      scrollBy(primary);
    };
    let dragStartCoord = 0;
    let dragStartOffset = 0;
    let dragStartX = 0;
    let dragStartY = 0;
    let dragging = false;
    let axisDecided = false;
    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      dragging = true;
      axisDecided = false;
      dragStartX = touch.clientX;
      dragStartY = touch.clientY;
      dragStartCoord = orientation === 'vertical' ? touch.clientY : touch.clientX;
      dragStartOffset = offsetRef.current;
    };
    const onTouchMove = (event: TouchEvent) => {
      if (!dragging) return;
      const touch = event.touches[0];
      if (!touch) return;
      if (!axisDecided) {
        const dx = Math.abs(touch.clientX - dragStartX);
        const dy = Math.abs(touch.clientY - dragStartY);
        if (dx < 6 && dy < 6) return;
        const vertical = dy >= dx;
        const ownsGesture = orientation === 'vertical' ? vertical : !vertical;
        if (!ownsGesture) {
          dragging = false; // the parent axis handles this drag
          return;
        }
        axisDecided = true;
      }
      const coord = orientation === 'vertical' ? touch.clientY : touch.clientX;
      event.preventDefault();
      scrollToOffset(dragStartOffset + (dragStartCoord - coord), { animate: false });
    };
    const onTouchEnd = () => {
      dragging = false;
    };

    viewport.addEventListener('wheel', onWheel, { passive: false });
    viewport.addEventListener('touchstart', onTouchStart, { passive: false });
    viewport.addEventListener('touchmove', onTouchMove, { passive: false });
    viewport.addEventListener('touchend', onTouchEnd);
    return () => {
      viewport.removeEventListener('wheel', onWheel);
      viewport.removeEventListener('touchstart', onTouchStart);
      viewport.removeEventListener('touchmove', onTouchMove);
      viewport.removeEventListener('touchend', onTouchEnd);
    };
  }, [orientation, scrollBy, scrollToOffset]);

  // Layout-only measurement: sizes are used for clamping, never per-focus.
  useEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport) return;

    const measure = () => {
      const contentSize =
        orientation === 'vertical' ? content?.scrollHeight ?? 0 : content?.scrollWidth ?? 0;
      const viewportSize =
        orientation === 'vertical' ? viewport.clientHeight : viewport.clientWidth;
      setSizes(contentSize, viewportSize);
    };

    measure();
    apply();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    if (content) observer.observe(content);
    return () => observer.disconnect();
  }, [orientation, setSizes, apply]);

  useEffect(() => stopTween, [stopTween]);

  return {
    orientation,
    viewportRef,
    contentRef,
    getOffset: () => offsetRef.current,
    getContentSize: () => contentSizeRef.current,
    getViewportSize: () => viewportSizeRef.current,
    setSizes,
    setPendingOffset,
    onSized,
    isSized: () => sizedRef.current,
    scrollToOffset,
    scrollBy,
    subscribe,
    isAnimating: () => tweenRef.current !== null,
  };
}
