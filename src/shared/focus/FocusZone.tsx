import React from 'react';
import { useFocusable } from './useFocusable.ts';

export interface FocusZoneProps {
  focusKey?: string;
  isFocusBoundary?: boolean;
  saveLastFocusedChild?: boolean;
  autoRestoreFocus?: boolean;
  trackChildren?: boolean;
  className?: string;
  children: React.ReactNode;
  onEnterPress?: () => void;
  orientation?: 'horizontal' | 'vertical' | 'grid';
}

/**
 * FocusZone wraps a navigable section (e.g. category row, side sheet, menu)
 * and controls focus retention and boundaries.
 */
export const FocusZone: React.FC<FocusZoneProps> = ({
  focusKey,
  isFocusBoundary = false,
  saveLastFocusedChild = true,
  autoRestoreFocus = true,
  trackChildren = true,
  className = '',
  children,
  onEnterPress,
}) => {
  const { ref, hasFocusedChild } = useFocusable({
    focusKey,
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
      {children}
    </div>
  );
};
