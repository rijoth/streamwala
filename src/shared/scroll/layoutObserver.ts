/**
 * Layout-change signal shared by the focus-driven scrollers.
 *
 * `ResizeObserver` is the primary trigger: it reports border-box changes of the
 * observed element (and of its subtree owners) without polling. It is not
 * universally available on the devices this app ships to — some TV WebViews are
 * older than Chromium 64 — and a silently missing observer used to freeze the
 * scroll metrics forever (BUG-028: an EPG/history row inserted above the focused
 * Home row left that row painted above the clip viewport, because
 * `useRowMetrics` measured once and `useScrollAxis` kept a stale size model).
 *
 * Every source therefore falls back to cheap, observer-independent signals:
 *
 * | Source | Reports |
 * |---|---|
 * | `ResizeObserver` | element border-box size (when supported) |
 * | `MutationObserver` | rows/children added or removed, geometry-bearing attributes (`class`, `style`, `data-scroll-row`, `data-hero-state`) |
 * | `resize` / `orientationchange` / `visualViewport` | viewport size, i.e. the focus line |
 *
 * All sources are coalesced into at most one callback per animation frame, so a
 * burst of focus-class mutations costs a single re-measure.
 */
export interface LayoutObserverOptions {
  /**
   * Watch DOM mutations below the target (rows added/removed/reordered, hero
   * class swaps). Required when the target is a *container* whose children move.
   */
  subtree?: boolean;
  /** Report element size changes. Default `true`. */
  size?: boolean;
}

/**
 * Calls `onChange` whenever the target's layout — or the layout of anything
 * below it that can move it — may have changed. Returns a cleanup function.
 */
export function observeLayoutChanges(
  target: HTMLElement,
  onChange: () => void,
  options: LayoutObserverOptions = {}
): () => void {
  const { subtree = false, size = true } = options;
  const hasResizeObserver = typeof ResizeObserver !== 'undefined';

  let frame: number | null = null;
  let active = true;

  const schedule = () => {
    if (!active || frame !== null) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      onChange();
    });
  };

  let resize: ResizeObserver | null = null;
  if (size && hasResizeObserver) {
    resize = new ResizeObserver(schedule);
    resize.observe(target);
  }

  // Without `ResizeObserver` a size change can only be inferred from the DOM:
  // classes/styles that encode layout (the hero swaps `min-h`/`h`), rows added
  // or removed, and the index attribute itself. `data-focused` is deliberately
  // absent so focus ring churn does not trigger a re-measure storm.
  const watchSubtree = subtree || (size && !hasResizeObserver);
  let mutation: MutationObserver | null = null;
  if (watchSubtree && typeof MutationObserver !== 'undefined') {
    mutation = new MutationObserver((records) => {
      // The scroller animates *this* element's `transform` every frame while a
      // tween runs. That is a style mutation but not a layout change, so
      // re-measuring on it would burn a layout pass per frame for nothing.
      const relevant = records.some(
        (record) => !(record.target === target && record.attributeName === 'style')
      );
      if (relevant) schedule();
    });
    mutation.observe(target, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'data-scroll-row', 'data-hero-state'],
    });
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('resize', schedule);
    window.addEventListener('orientationchange', schedule);
  }
  const visualViewport = typeof window === 'undefined' ? null : window.visualViewport;
  visualViewport?.addEventListener('resize', schedule);

  return () => {
    active = false;
    if (frame !== null) cancelAnimationFrame(frame);
    resize?.disconnect();
    mutation?.disconnect();
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', schedule);
      window.removeEventListener('orientationchange', schedule);
    }
    visualViewport?.removeEventListener('resize', schedule);
  };
}
