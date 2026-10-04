import { act } from '@testing-library/react';

/**
 * Remote-control key dispatch for tests. Builds the same normalized
 * KeyboardEvent shape a TV remote / browser would deliver, including the
 * deprecated `keyCode`/`which` our input layer still falls back to.
 */

export type RemoteKey =
  | 'Up'
  | 'Down'
  | 'Left'
  | 'Right'
  | 'Enter'
  | 'Back'
  | 'Backspace'
  | 'Red'
  | 'Green'
  | 'Yellow'
  | 'Blue'
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9';

interface ResolvedKey {
  key: string;
  code: string;
  keyCode: number;
}

const COLOR_KEYS: Record<string, ResolvedKey> = {
  Red: { key: 'Red', code: 'ColorF0Red', keyCode: 403 },
  Green: { key: 'Green', code: 'ColorF1Green', keyCode: 404 },
  Yellow: { key: 'Yellow', code: 'ColorF2Yellow', keyCode: 405 },
  Blue: { key: 'Blue', code: 'ColorF3Blue', keyCode: 406 },
};

export function resolveRemoteKey(name: RemoteKey): ResolvedKey {
  switch (name) {
    case 'Up':
      return { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 };
    case 'Down':
      return { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 };
    case 'Left':
      return { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 };
    case 'Right':
      return { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 };
    case 'Enter':
      return { key: 'Enter', code: 'Enter', keyCode: 13 };
    case 'Back':
      return { key: 'Escape', code: 'Escape', keyCode: 27 };
    case 'Backspace':
      return { key: 'Backspace', code: 'Backspace', keyCode: 8 };
    case 'Red':
    case 'Green':
    case 'Yellow':
    case 'Blue':
      return COLOR_KEYS[name];
    default: {
      const digit = Number(name);
      return { key: name, code: `Digit${name}`, keyCode: 48 + digit };
    }
  }
}

export interface PressKeyOptions {
  /** Defaults to `window`, matching the app's capture-phase remote listener. */
  target?: EventTarget;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
}

/** Dispatches a normalized `keydown` the way a TV remote would. */
export function pressKey(name: RemoteKey, options: PressKeyOptions = {}): KeyboardEvent {
  const resolved = resolveRemoteKey(name);
  const target = options.target ?? window;

  const event = new KeyboardEvent('keydown', {
    key: resolved.key,
    code: resolved.code,
    bubbles: true,
    cancelable: true,
    altKey: options.altKey,
    ctrlKey: options.ctrlKey,
    metaKey: options.metaKey,
    shiftKey: options.shiftKey,
  });

  // jsdom does not honour keyCode/which in the init dict; define them so the
  // deprecated fallbacks in normalizeKeyEvent() behave like a real browser.
  Object.defineProperty(event, 'keyCode', { get: () => resolved.keyCode });
  Object.defineProperty(event, 'which', { get: () => resolved.keyCode });

  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}