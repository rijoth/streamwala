import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor shell for the 10-foot leanback player.
 *
 * The web app stays 100% client-side; the native shell only supplies:
 *  - a hardware-accelerated Chromium WebView with an origin (`https://localhost`)
 *    so IndexedDB/Dexie and MSE playback behave like a real page
 *  - Android TV (leanback) launcher entry points
 *  - BACK / lifecycle bridging into `src/shared/input`
 *
 * Both form factors (mobile + TV) are built from this single web bundle via
 * Gradle product flavors; see `android/app/build.gradle`.
 */
const config: CapacitorConfig = {
  appId: 'tv.aether.iptv',
  appName: 'Aether IPTV',
  webDir: 'dist',
  backgroundColor: '#0b0c13',
  android: {
    // IPTV panels still serve plain http:// endpoints (Xtream/M3U) and many
    // stream hosts omit CORS headers. The WebView origin is https://localhost,
    // so cleartext + mixed content must stay allowed at the shell level.
    allowMixedContent: true,
    webContentsDebuggingEnabled: false,
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
