import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { dispatchBack } from './useTvInput.ts';

let initialized = false;

/**
 * Bridges the Android hardware/remote BACK button into the shared input funnel.
 *
 * Android delivers BACK to the Activity, not to the WebView's DOM, so the
 * Capacitor `backButton` event must be routed through the exact same
 * `dispatchBack()` funnel used for web BACK keys (BUG-002: only one physical
 * press may pop one overlay layer).
 *
 * When no overlay/route consumed the press, the app exits instead of leaving a
 * blank WebView on screen.
 */
export function initNativeBackBridge(): void {
  if (initialized || !Capacitor.isNativePlatform()) return;
  initialized = true;

  void CapacitorApp.addListener('backButton', () => {
    if (dispatchBack()) return;
    void CapacitorApp.exitApp();
  });
}
