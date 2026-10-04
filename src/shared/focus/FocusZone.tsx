import React from 'react';
import { useFocusable } from './useFocusable.ts';
import { FocusScope } from './FocusScope.tsx';

export interface FocusZoneProps {
  focusKey?: string;
  /**
   * Whether the zone itself is a D-pad stop. Set to `false` for pure layout
   * wrappers: a large container that captures focus has no focus ring and
   * swallows arrow presses, because norigin only navigates between siblings
   * (BUG-020).
   */
  focusable?: boolean;
  isFocusBoundary?: boolean;
  saveLastFocusedChild?: boolean;
  autoRestoreFocus?: boolean;
  trackChildren?: boolean;
  className?: string;
  children: React.ReactNode;
  onEnterPress?: () => void;
  orientation?: 'horizontal' | 'vertical' | 'grid';
  /**
   * Make the zone the focus *parent* of its children (`FocusScope`), which is
   * the default: without it children register against the root, so the zone is
   * a focus stop of its own (no ring, arrows appear dead) and the library's
   * tree navigation cannot descend into it (BUG-020). Set to `false` only for
   * a zone that must stay a flat sibling of its contents.
   */
  ownsChildren?: boolean;
}

/**
 * FocusZone wraps a navigable section (e.g. category row, side sheet, menu)
 * and controls focus retention and boundaries.
 */
export const FocusZone: React.FC<FocusZoneProps> = ({
  focusKey,
  focusable = true,
  isFocusBoundary = false,
  saveLastFocusedChild = true,
  autoRestoreFocus = true,
  trackChildren = true,
  className = '',
  children,
  onEnterPress,
  ownsChildren = true,
}) => {
  const { ref, hasFocusedChild, focusKey: resolvedFocusKey } = useFocusable({
    focusKey,
    focusable,
    isFocusBoundary,
    saveLastFocusedChild,
    autoRestoreFocus,
    trackChildren,
    onEnterPress,
  });

  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      className={`${className} ${hasFocusedChild ? 'has-focused-child' : ''}`}
    >
      {ownsChildren ? <FocusScope focusKey={resolvedFocusKey}>{children}</FocusScope> : children}
    </div>
  );
};
