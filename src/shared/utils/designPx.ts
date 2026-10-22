import { useEffect, useState } from 'react';

/**
 * The design-pixel unit (ADR 035).
 *
 * `src/index.css` derives `--u` from the viewport (one design px on the
 * 1920x1080 canvas) and pins the root font-size to `16 * --u`. CSS-authored
 * geometry follows automatically; JS index math (column counts, carousel
 * offsets, fallback row heights) does not, so it reads the same unit here.
 *
 * The fallback is 1 so unit tests and any environment without a computed
 * style keep the old 1920-canvas behaviour.
 */
export const DESIGN_PX_EVENT = 'streamwala:design-px';

export function readDesignPx(): number {
  if (typeof document === 'undefined') return 1;
  // Read the resolved root font-size, not `--u` directly: a non-registered custom
  // property keeps its `clamp(...)` token text at computed-value time, so
  // parseFloat would see NaN. The root font-size is pinned to 16 design px.
  const value = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) / 16;
  return Number.isFinite(value) && value > 0 ? value : 1;
}

/**
 * Live design-pixel factor. Re-reads when the viewport changes (resize,
 * rotation, soft keyboard), when the root font/element box changes, and when
 * `applyTheme` rewrites `--ui-scale` and dispatches {@link DESIGN_PX_EVENT}.
 */
export function useDesignPx(): number {
  const [designPx, setDesignPx] = useState(readDesignPx);

  useEffect(() => {
    const sync = () => setDesignPx(readDesignPx());
    sync();

    window.addEventListener('resize', sync);
    window.addEventListener('orientationchange', sync);
    // Keep this an event-name literal: the no-raw-key-listeners guardrail flags
    // an identifier because it cannot prove the name is not a key event.
    window.addEventListener('streamwala:design-px', sync);
    window.visualViewport?.addEventListener('resize', sync);

    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(sync) : undefined;
    observer?.observe(document.documentElement);

    return () => {
      window.removeEventListener('resize', sync);
      window.removeEventListener('orientationchange', sync);
      window.removeEventListener('streamwala:design-px', sync);
      window.visualViewport?.removeEventListener('resize', sync);
      observer?.disconnect();
    };
  }, []);

  return designPx;
}
