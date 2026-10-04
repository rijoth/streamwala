import { useEffect, useRef } from 'react';
import { useFocusable as noriginUseFocusable, UseFocusableConfig } from '@noriginmedia/norigin-spatial-navigation';
import { initFocusEngine } from './spatial.ts';
import { ArrowHandler, resolveArrowNavigation } from './decision.ts';

export interface AppFocusableConfig extends Omit<UseFocusableConfig, 'onEnterPress' | 'onArrowPress'> {
  onEnterPress?: (details?: unknown) => void;
  /**
   * Return a branded FocusDecision (ALLOW_DEFAULT_NAVIGATION or
   * BLOCK_NAVIGATION). Raw booleans are rejected at compile time because the
   * library's boolean polarity is inverted and error-prone (BUG-001).
   */
  onArrowPress?: ArrowHandler;
  autoScroll?: boolean;
  autoFocus?: boolean;
}

export function useFocusable(config: AppFocusableConfig = {}) {
  // Synchronous fail-safe check to guarantee layoutAdapter exists before hook mount
  if (typeof window !== 'undefined') {
    initFocusEngine();
  }

  const { autoScroll = true, autoFocus = false, onArrowPress, ...rest } = config;
  const elementRef = useRef<HTMLElement | null>(null);

  const {
    ref: noriginRef,
    focused,
    hasFocusedChild,
    focusKey,
    focusSelf,
    ...otherProps
  } = noriginUseFocusable<object, HTMLElement>({
    ...rest,
    onArrowPress: onArrowPress
      ? (direction: string, details: unknown) => resolveArrowNavigation(onArrowPress, direction, details)
      : undefined,
  });

  // Combine refs
  const handleRef = (node: HTMLElement | null) => {
    elementRef.current = node;
    if (typeof noriginRef === 'function') {
      (noriginRef as (node: HTMLElement | null) => void)(node);
    } else if (noriginRef && 'current' in noriginRef) {
      (noriginRef as React.MutableRefObject<HTMLElement | null>).current = node;
    }
  };

  useEffect(() => {
    if (autoFocus && focusSelf) {
      focusSelf();
    }
  }, [autoFocus, focusSelf]);

  // Center or smoothly bring the element into viewport when focused on 10-foot screen
  useEffect(() => {
    if (focused && autoScroll && elementRef.current) {
      const el = elementRef.current;
      // Some webviews (and jsdom) do not implement scrollIntoView; focusing must
      // never throw because of it.
      if (typeof el.scrollIntoView !== 'function') return;
      try {
        el.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center',
        });
      } catch {
        el.scrollIntoView();
      }
    }
  }, [focused, autoScroll]);

  return {
    ref: handleRef,
    focused,
    hasFocusedChild,
    focusKey,
    focusSelf,
    elementRef,
    ...otherProps,
  };
}
