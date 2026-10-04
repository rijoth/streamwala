import React from 'react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { prefersReducedMotion, ScrollAxisApi, useScrollAxis } from './useScrollAxis.ts';

type RafCb = FrameRequestCallback;

let rafCb: RafCb | null = null;
let rafId = 0;
let now = 0;

function makeHarness() {
  let api: ScrollAxisApi | null = null;
  function Harness() {
    api = useScrollAxis({ orientation: 'vertical' });
    return (
      <div ref={api.viewportRef}>
        <div ref={api.contentRef}>content</div>
      </div>
    );
  }
  render(<Harness />);
  return () => api as ScrollAxisApi;
}

beforeEach(() => {
  rafCb = null;
  rafId = 0;
  now = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: RafCb) => {
    rafCb = cb;
    rafId += 1;
    return rafId;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {
    rafCb = null;
  });
  vi.spyOn(performance, 'now').mockImplementation(() => now);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function frame(time: number) {
  now = time;
  act(() => {
    const cb = rafCb;
    rafCb = null;
    cb?.(time);
  });
}

describe('useScrollAxis', () => {
  it('clamps offsets to the content bounds', () => {
    const getApi = makeHarness();
    act(() => getApi().setSizes(1000, 400));
    act(() => getApi().scrollToOffset(9999, { animate: false }));
    expect(getApi().getOffset()).toBe(600);
    act(() => getApi().scrollToOffset(-50, { animate: false }));
    expect(getApi().getOffset()).toBe(0);
  });

  it('animates to a target and settles', () => {
    const getApi = makeHarness();
    act(() => getApi().setSizes(2000, 500));
    act(() => getApi().scrollToOffset(300));
    expect(getApi().isAnimating()).toBe(true);
    frame(110);
    expect(getApi().getOffset()).toBeGreaterThan(0);
    frame(500);
    expect(getApi().getOffset()).toBe(300);
    expect(getApi().isAnimating()).toBe(false);
  });

  it('retargets mid-flight and the latest target wins', () => {
    const getApi = makeHarness();
    act(() => getApi().setSizes(5000, 500));
    act(() => getApi().scrollToOffset(200));
    frame(110);
    act(() => getApi().scrollToOffset(900));
    frame(1000);
    expect(getApi().getOffset()).toBe(900);
    expect(getApi().isAnimating()).toBe(false);
  });

  it('applies a pending offset once sizes are known', () => {
    const getApi = makeHarness();
    act(() => getApi().setPendingOffset(250));
    expect(getApi().getOffset()).toBe(0);
    act(() => getApi().setSizes(2000, 500));
    expect(getApi().getOffset()).toBe(250);
  });

  it('notifies subscribers of offset changes', () => {
    const getApi = makeHarness();
    const seen: number[] = [];
    const unsubscribe = getApi().subscribe((offset) => seen.push(offset));
    act(() => getApi().setSizes(2000, 500));
    act(() => getApi().scrollBy(120));
    unsubscribe();
    act(() => getApi().scrollBy(120));
    expect(seen).toContain(120);
    expect(seen[seen.length - 1]).toBe(120);
  });

  it('jumps instantly under prefers-reduced-motion', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })
    );
    expect(prefersReducedMotion()).toBe(true);

    const getApi = makeHarness();
    act(() => getApi().setSizes(3000, 500));
    act(() => getApi().scrollToOffset(800));
    expect(getApi().getOffset()).toBe(800);
    expect(getApi().isAnimating()).toBe(false);
  });
});
