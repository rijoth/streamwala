import { useEffect, useRef } from 'react';
import { useFocusable as noriginUseFocusable, UseFocusableConfig } from '@noriginmedia/norigin-spatial-navigation';
import { initFocusEngine } from './spatial.ts';

export interface AppFocusableConfig extends Omit<UseFocusableConfig, 'onEnterPress' | 'onArrowPress'> {
  onEnterPress?: (details?: unknown) => void;
  onArrowPress?: (direction: string, details?: unknown) => boolean;
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
  } = noriginUseFocusable({
    ...rest,
    onArrowPress: onArrowPress ? (direction: string, details: any) => {
      const res = onArrowPress(direction, details);
      return typeof res === 'boolean' ? res : true;
    } : undefined,
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
