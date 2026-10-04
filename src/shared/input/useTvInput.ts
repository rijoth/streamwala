import { useEffect, useRef } from 'react';
import { normalizeKeyEvent, SemanticKeyAction, NormalizedKeyEvent } from './keyCodes.ts';

type KeyActionHandler = (event: NormalizedKeyEvent) => boolean | void;

// Global stack for modal / overlay back actions
const backHandlerStack: (() => boolean | void)[] = [];

export function pushBackHandler(handler: () => boolean | void) {
  backHandlerStack.push(handler);
  ensureBackListener();
  return () => {
    const idx = backHandlerStack.lastIndexOf(handler);
    if (idx !== -1) {
      backHandlerStack.splice(idx, 1);
    }
  };
}

/**
 * Runs the topmost BACK handler and pops exactly that handler when it reports
 * itself as handled. Returns true if a handler was present.
 *
 * This is the single funnel for BACK dispatch. It must only be called once per
 * physical key press (see ensureBackListener); every `useTvInput` instance used
 * to run this logic inline, so N mounted hooks popped N layers per press.
 */
export function dispatchBack(): boolean {
  if (backHandlerStack.length === 0) return false;
  const handler = backHandlerStack[backHandlerStack.length - 1];
  const handled = handler();
  if (handled !== false) {
    const idx = backHandlerStack.lastIndexOf(handler);
    if (idx !== -1) {
      backHandlerStack.splice(idx, 1);
    }
  }
  return true;
}

export function popBackHandler(): boolean {
  return dispatchBack();
}

/** True when the active element accepts text input. */
export function isEditableElement(el: Element | null): boolean {
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLElement && el.isContentEditable)
  );
}

let backListenerInstalled = false;

/**
 * Installs a single window-level BACK listener. Keeping this out of
 * `useTvInput` prevents duplicate dispatch when several components use the hook.
 */
function ensureBackListener() {
  if (backListenerInstalled || typeof window === 'undefined') return;
  backListenerInstalled = true;

  window.addEventListener(
    'keydown',
    (e: KeyboardEvent) => {
      const normalized = normalizeKeyEvent(e);
      if (!normalized || normalized.action !== 'BACK') return;

      // Backspace inside a text field edits the value; it must not navigate back.
      if (normalized.rawKey === 'Backspace' && isEditableElement(document.activeElement)) {
        return;
      }
      if (backHandlerStack.length === 0) return;

      e.preventDefault();
      e.stopPropagation();
      dispatchBack();
    },
    { capture: true }
  );
}

export function useTvInput(onAction?: KeyActionHandler, deps: unknown[] = []) {
  const onActionRef = useRef(onAction);
  onActionRef.current = onAction;

  useEffect(() => {
    ensureBackListener();

    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = isEditableElement(document.activeElement);

      const normalized = normalizeKeyEvent(e);
      if (!normalized) return;

      // Let editable fields own character input and Backspace editing.
      if (
        isInput &&
        (normalized.action === 'DIGIT' ||
          (normalized.action === 'BACK' && normalized.rawKey === 'Backspace'))
      ) {
        return;
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
