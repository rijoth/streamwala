import React from 'react';
import { FocusContext } from '@noriginmedia/norigin-spatial-navigation';

export interface FocusScopeProps {
  focusKey: string;
  children: React.ReactNode;
}

/**
 * Declares the focus parent for descendants.
 *
 * `useFocusable` reads its parent from the nearest `FocusContext`, and the
 * library does not provide that context automatically: without this wrapper a
 * container's children are registered against the ROOT, so the container's
 * `preferredChildFocusKey` / `saveLastFocusedChild` / boundary rules are
 * silently ignored. Use it for any wrapper that must own its children.
 */
export const FocusScope: React.FC<FocusScopeProps> = ({ focusKey, children }) => (
  <FocusContext.Provider value={focusKey}>{children}</FocusContext.Provider>
);
