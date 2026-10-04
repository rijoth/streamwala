import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { onNavAccelerate, setNavRepeatConfig, useTvInput } from './useTvInput.ts';
import { DEFAULT_SCROLL_CONFIG } from '../scroll/config.ts';

function arrow(repeat: boolean, keyCode = 40, key = 'ArrowDown'): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, repeat });
  Object.defineProperty(event, 'keyCode', { get: () => keyCode });
  Object.defineProperty(event, 'which', { get: () => keyCode });
  window.dispatchEvent(event);
  return event;
}

function keyUp(keyCode = 40, key = 'ArrowDown') {
  const event = new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true });
  Object.defineProperty(event, 'keyCode', { get: () => keyCode });
  Object.defineProperty(event, 'which', { get: () => keyCode });
  window.dispatchEvent(event);
}

describe('held-key repeat gate (shared/input)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    setNavRepeatConfig(DEFAULT_SCROLL_CONFIG);
    keyUp();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('throttles browser auto-repeat and accelerates after the hold threshold', () => {
    renderHook(() => useTvInput());
    const steps: number[] = [];
    const unsubscribe = onNavAccelerate((_action, step) => steps.push(step));

    const fresh = arrow(false);
    expect(fresh.defaultPrevented).toBe(false);

    vi.setSystemTime(50);
    const throttled = arrow(true);
    expect(throttled.defaultPrevented).toBe(true);

    vi.setSystemTime(100);
    const accepted = arrow(true);
    expect(accepted.defaultPrevented).toBe(false);
    expect(steps).toEqual([]);

    vi.setSystemTime(550);
    arrow(true);
    expect(steps).toEqual([2]);

    vi.setSystemTime(1100);
    arrow(true);
    expect(steps).toEqual([2, 4]);

    unsubscribe();
    keyUp();
  });

  it('resets on key release so a new press is accepted immediately', () => {
    renderHook(() => useTvInput());
    arrow(false);
    vi.setSystemTime(10);
    expect(arrow(true).defaultPrevented).toBe(true);
    keyUp();
    vi.setSystemTime(20);
    expect(arrow(false).defaultPrevented).toBe(false);
  });

  it('does not throttle non-navigation keys', () => {
    renderHook(() => useTvInput());
    const first = arrow(false, 13, 'Enter');
    const second = arrow(true, 13, 'Enter');
    expect(first.defaultPrevented).toBe(false);
    expect(second.defaultPrevented).toBe(false);
  });
});
