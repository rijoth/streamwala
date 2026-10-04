import React, { useEffect, useRef } from 'react';
import type { ScrollAxisApi } from '../../shared/scroll/index.ts';

export interface EpgMirrorProps {
  axis: ScrollAxisApi;
  orientation: 'x' | 'y';
  className?: string;
  children: React.ReactNode;
}

/**
 * Mirrors a scroll axis offset onto a pinned element (the EPG time header and
 * the channel column). Keeps the "now" indicator and channel labels visually
 * aligned with the transform-scrolled program grid without a second source of
 * truth.
 */
export const EpgMirror: React.FC<EpgMirrorProps> = ({ axis, orientation, className = '', children }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const apply = (offset: number) => {
      if (!ref.current) return;
      ref.current.style.transform =
        orientation === 'x' ? `translate3d(${-offset}px, 0, 0)` : `translate3d(0, ${-offset}px, 0)`;
    };
    apply(axis.getOffset());
    return axis.subscribe(apply);
  }, [axis, orientation]);

  return (
    <div ref={ref} className={`will-change-transform ${className}`}>
      {children}
    </div>
  );
};
