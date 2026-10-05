import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useAppBoot } from './useAppBoot.ts';

/**
 * Boot-sequence behaviour. The timing options are passed explicitly so these
 * tests do not depend on the shipped constants, but they are short on purpose:
 * the floor assertions are lower bounds, which `setTimeout` cannot undershoot,
 * so they stay deterministic instead of flaky.
 */
const FAST = { minSplashMs: 150, fadeMs: 300, timeoutMs: 2_000 };

describe('useAppBoot', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('keeps the splash up for the minimum display time, fading before it leaves', async () => {
    const startedAt = performance.now();
    const { result } = renderHook(() => useAppBoot(async () => {}, FAST));

    await waitFor(() => expect(result.current.isLeaving).toBe(true));
    // Fading, but still on screen: the app is mounted underneath by now.
    expect(result.current.isBooting).toBe(true);
    await waitFor(() => expect(result.current.isBooting).toBe(false));

    // Both the floor and the fade are pure `setTimeout` waits, so the total can
    // only be longer than the sum — no timing tolerance is needed to keep this
    // deterministic.
    expect(performance.now() - startedAt).toBeGreaterThanOrEqual(
      FAST.minSplashMs + FAST.fadeMs
    );
  });

  it('does not reveal the app before the data load has settled', async () => {
    let resolveLoad: () => void = () => {};
    const load = () =>
      new Promise<void>((resolve) => {
        resolveLoad = resolve;
      });

    const { result } = renderHook(() =>
      useAppBoot(load, { ...FAST, minSplashMs: 0, fadeMs: 0 })
    );

    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(result.current.isBooting).toBe(true);

    await act(async () => {
      resolveLoad();
    });
    await waitFor(() => expect(result.current.isBooting).toBe(false));
  });

  it('is a first-boot surface: reloading data later never re-shows the splash', async () => {
    const load = vi.fn(async () => {});
    const { result } = renderHook(() =>
      useAppBoot(load, { ...FAST, minSplashMs: 0, fadeMs: 0 })
    );

    await waitFor(() => expect(result.current.isBooting).toBe(false));

    await act(async () => {
      await result.current.refreshData();
    });

    expect(load).toHaveBeenCalledTimes(2);
    expect(result.current.isBooting).toBe(false);
    expect(result.current.isLeaving).toBe(false);
  });

  it('releases the splash when the storage layer never settles', async () => {
    const { result } = renderHook(() =>
      useAppBoot(() => new Promise<void>(() => {}), {
        ...FAST,
        minSplashMs: 0,
        fadeMs: 0,
        timeoutMs: 40,
      })
    );

    await waitFor(() => expect(result.current.isBooting).toBe(false));
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('did not settle'));
  });

  it('clears the splash when the load fails, and never rejects its callers', async () => {
    const failure = new Error('IndexedDB blocked');
    const load = vi.fn(async () => {
      throw failure;
    });

    const { result } = renderHook(() =>
      useAppBoot(load, { ...FAST, minSplashMs: 0, fadeMs: 0 })
    );

    await waitFor(() => expect(result.current.isBooting).toBe(false));
    expect(errorSpy).toHaveBeenCalledWith('Error loading IPTV data:', failure);
    await expect(result.current.refreshData()).resolves.toBeUndefined();
  });
});
