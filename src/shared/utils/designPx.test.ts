import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DESIGN_PX_EVENT, readDesignPx, useDesignPx } from './designPx.ts';

describe('readDesignPx', () => {
  afterEach(() => {
    document.documentElement.style.removeProperty('font-size');
  });

  it('falls back to 1 when the unit is unavailable', () => {
    expect(readDesignPx()).toBe(1);
  });

  it('reads the design unit from the resolved root font-size', () => {
    document.documentElement.style.fontSize = '8px';
    expect(readDesignPx()).toBe(0.5);
  });
});

describe('useDesignPx', () => {
  afterEach(() => {
    document.documentElement.style.removeProperty('font-size');
  });

  it('re-reads the unit when the UI-scale event fires', () => {
    const { result } = renderHook(() => useDesignPx());
    expect(result.current).toBe(1);

    document.documentElement.style.fontSize = '10.667px';
    act(() => {
      window.dispatchEvent(new Event(DESIGN_PX_EVENT));
    });

    expect(result.current).toBeCloseTo(0.667, 3);
  });

  it('re-reads the unit on viewport resize', () => {
    const { result } = renderHook(() => useDesignPx());

    document.documentElement.style.fontSize = '21.333px';
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current).toBeCloseTo(1.333, 3);
  });
});
