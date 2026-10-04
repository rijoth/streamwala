import { useEffect, useRef } from 'react';
import { normalizeKeyEvent, SemanticKeyAction, NormalizedKeyEvent } from './keyCodes.ts';

type KeyActionHandler = (event: NormalizedKeyEvent) => boolean | void;

// Global stack for modal / overlay back actions
const backHandlerStack: (() => boolean | void)[] = [];

export function pushBackHandler(handler: () => boolean | void) {
  backHandlerStack.push(handler);
  return () => {
    const idx = backHandlerStack.lastIndexOf(handler);
    if (idx !== -1) {
      backHandlerStack.splice(idx, 1);
    }
  };
}

export function popBackHandler(): boolean {
  if (backHandlerStack.length > 0) {
    const handler = backHandlerStack.pop();
    if (handler) {
      const handled = handler();
      return handled !== false;
    }
  }
  return false;
}

export function useTvInput(onAction?: KeyActionHandler, deps: unknown[] = []) {
  const onActionRef = useRef(onAction);
  onActionRef.current = onAction;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept typing in native input or textarea fields unless it's a media or back key
      const activeEl = document.activeElement;
      const isInput = activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement;

      const normalized = normalizeKeyEvent(e);
      if (!normalized) return;

      if (isInput && normalized.action === 'DIGIT') {
        return; // Allow typing digits inside text inputs
      }

      if (normalized.action === 'BACK') {
        if (backHandlerStack.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          const handler = backHandlerStack[backHandlerStack.length - 1];
          const handled = handler();
          if (handled !== false) {
            backHandlerStack.pop();
            return;
          }
        }
      }

      if (onActionRef.current) {
        const handled = onActionRef.current(normalized);
        if (handled) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, deps);
}

/**
 * Hides mouse cursor after 3 seconds of inactivity to maintain clean leanback view.
 */
export function useIdleCursor(timeoutMs: number = 3000) {
  useEffect(() => {
    let timer: NodeJS.Timeout;

    const onMouseMove = () => {
      document.body.style.cursor = 'default';
      clearTimeout(timer);
      timer = setTimeout(() => {
        document.body.style.cursor = 'none';
      }, timeoutMs);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('keydown', onMouseMove);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('keydown', onMouseMove);
      document.body.style.cursor = 'default';
    };
  }, [timeoutMs]);
}
