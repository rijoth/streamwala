import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Minimum time the splash stays on screen, measured from its first paint, so a
 * warm boot does not strobe. `.app-splash` in src/index.css mirrors the fade
 * length, and `src/shared/ui/AppSplash.tsx` is what reads both.
 */
export const SPLASH_MIN_MS = 400;

/** Cross-fade from the splash to the app. */
export const SPLASH_FADE_MS = 180;

/**
 * Hard cap on the boot sequence. A storage layer that never settles (blocked
 * IndexedDB, a migration wedged behind another tab, a browser that never fires
 * the open callback) must not present as a permanently branded screen.
 */
export const BOOT_TIMEOUT_MS = 8_000;

export interface AppBootOptions {
  minSplashMs?: number;
  fadeMs?: number;
  timeoutMs?: number;
}

export interface AppBootState {
  /** The splash is on screen, including while it fades out. */
  isBooting: boolean;
  /** The splash is fading out, so the app may already render underneath it. */
  isLeaving: boolean;
  /**
   * Re-runs the data load. Stable identity, and it never rejects — the screens
   * that call it from D-pad handlers must not produce unhandled rejections.
   */
  refreshData: () => Promise<void>;
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Owns the cold-boot sequence behind `AppSplash` (ADR 022).
 *
 * The splash is a **first-boot only** surface: `refreshData` is called again by
 * EPG changes, the Settings refresh action and onboarding completion, and none
 * of those may cover an already-running app with a full-screen splash. That is
 * what `settledRef` is for; it is not a redundant guard.
 *
 * The gate waits on the data the shell needs — playlists, the active playlist /
 * onboarding decision, channels and groups — and on nothing else. EPG refreshes
 * in the background behind its own progress UI, and `EpgProvider` is mounted by
 * `App` only after the gate opens, so no scheduler pass runs against a screen
 * that cannot be interacted with.
 */
export function useAppBoot(
  load: () => Promise<void>,
  {
    minSplashMs = SPLASH_MIN_MS,
    fadeMs = SPLASH_FADE_MS,
    timeoutMs = BOOT_TIMEOUT_MS,
  }: AppBootOptions = {}
): AppBootState {
  const [isBooting, setIsBooting] = useState(true);
  const [isLeaving, setIsLeaving] = useState(false);

  const settledRef = useRef(false);
  const paintedAtRef = useRef<number | null>(null);

  // Same commit as the splash's first paint: the floor has to be measured from
  // when the user could actually see it, not from module evaluation.
  useLayoutEffect(() => {
    paintedAtRef.current = performance.now();
  }, []);

  const refreshData = useCallback(async () => {
    try {
      await load();
    } catch (err) {
      // Logged, never rethrown: the boot effect must still clear the splash,
      // and the screens that reload data on a remote press must not reject.
      console.error('Error loading IPTV data:', err);
    }
  }, [load]);

  const finish = useCallback(async () => {
    if (settledRef.current) return;
    settledRef.current = true;

    const elapsed = performance.now() - (paintedAtRef.current ?? performance.now());
    const hold = Math.max(0, minSplashMs - elapsed);
    if (hold > 0) await delay(hold);

    setIsLeaving(true);
    if (fadeMs > 0) await delay(fadeMs);
    // Batched into one render: the splash is gone and the app takes over in the
    // same commit, so `isLeaving` never lingers as a stale overlay.
    setIsLeaving(false);
    setIsBooting(false);
  }, [fadeMs, minSplashMs]);

  useEffect(() => {
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      console.error(
        `Boot did not settle within ${timeoutMs}ms; revealing the app as-is.`
      );
      void finish();
    }, timeoutMs);

    void (async () => {
      await refreshData();
      clearTimeout(timer);
      // A timeout already revealed the app; the late arrival only fills in the
      // data the shell is already reading.
      if (!timedOut) await finish();
    })();

    return () => clearTimeout(timer);
  }, [finish, refreshData, timeoutMs]);

  return { isBooting, isLeaving, refreshData };
}
