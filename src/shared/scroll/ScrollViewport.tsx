import React from 'react';
import type { ScrollAxisApi } from './useScrollAxis.ts';

export interface ScrollViewportProps {
  api: ScrollAxisApi;
  className?: string;
  contentClassName?: string;
  testId?: string;
  children: React.ReactNode;
}

/**
 * Clipping viewport + transformed content for a {@link ScrollAxisApi}.
 *
 * The outer element clips (`overflow-hidden`); the inner element is the only
 * thing that moves, via `transform`. Callers add a focus-ring padding to
 * `contentClassName` so the 3 px ring / 1.04 scale are never clipped at the
 * leading and trailing edges.
 */
export const ScrollViewport: React.FC<ScrollViewportProps> = ({
  api,
  className = '',
  contentClassName = '',
  testId,
  children,
}) => (
  <div
    ref={api.viewportRef}
    data-testid={testId}
    data-scroll-axis={api.orientation}
    className={`relative overflow-hidden ${className}`}
  >
    <div
      ref={api.contentRef}
      className={`will-change-transform ${contentClassName}`}
    >
      {children}
    </div>
  </div>
);
