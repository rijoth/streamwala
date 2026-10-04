# Architecture & Technical Decisions (DECISIONS.md)

### ADR 001: 100% Client-Side Storage with Dexie IndexedDB
- **Context:** An IPTV playlist can easily contain 10,000–100,000 channels and megabytes of XMLTV EPG data.
- **Decision:** Use Dexie.js to store playlists, channels, groups, programs, favorites, and watch history in IndexedDB with compound indexes on `playlistId`, `groupId`, and `channelId`. Tiny settings remain in `localStorage`.
- **Consequence:** Zero server cost, total user privacy, offline resilience, and fast query execution.

### ADR 002: Spatial Navigation Engine Abstraction
- **Context:** Remote controls on Smart TVs require deterministic 2D directional navigation.
- **Decision:** Wrap `@noriginmedia/norigin-spatial-navigation` behind our internal `src/shared/focus` module (`useFocusable`, `FocusZone`, `FocusScope`).
- **Consequence:** UI components are decoupled from any specific navigation library and remain unit-testable and swappable.

### ADR 003: Multi-Engine Video Player Adapter
- **Context:** IPTV streams arrive as HLS (`.m3u8`), MPEG-TS streams (`.ts`), or standard MP4/WebM files. Different browsers/devices support different codecs natively.
- **Decision:** Define a `PlayerEngine` interface with three concrete adapters: `HlsPlayerEngine` (using `hls.js`), `MpegtsPlayerEngine` (using `mpegts.js`), and `NativePlayerEngine` (HTML5 `<video>`). Fallback order is automated with configurable preference.
- **Consequence:** Maximum playback compatibility across Chrome, Safari, Android TV WebView, and Tizen/webOS.

### ADR 004: CORS & Mixed-Content Strategy
- **Context:** Modern browsers enforce CORS and block mixed content (HTTP streams on HTTPS origins).
- **Decision:** Client-side detection of network fetch and playback failures with rich diagnostic modal explaining the root cause. Provide a user-configurable proxy URL template (e.g. `https://my-proxy/?url={url}`) without shipping an unmaintained third-party public proxy. Also bundle legal HTTPS test streams in the Demo mode.

### ADR 005: Client-Side Virtual Keyboard & Remote Text Entry
- **Context:** Android TV browsers sometimes fail to trigger OS soft keyboards on text inputs without user interaction.
- **Decision:** Provide a built-in 10-foot virtual keyboard with fast URL buttons (`http://`, `https://`, `.m3u8`, `.com`, `/`, etc.) alongside native input support.

### ADR 006: Synchronous Spatial Navigation Engine Initialization
- **Context:** `@noriginmedia/norigin-spatial-navigation` requires `init()` to create its `layoutAdapter` before any component calls `addFocusable`. Because child component `useEffect` hooks run before parent `useEffect` hooks, initializing inside `App.tsx` caused `this.layoutAdapter is undefined`.
- **Decision:** Call `initFocusEngine()` synchronously at module load time in `src/shared/focus/spatial.ts`, explicitly at the entry point in `src/main.tsx`, and as a synchronous pre-check in `useFocusable`.
- **Consequence:** Eliminates runtime race conditions during initial mounting and guarantees `measureLayout` always has a valid adapter.

### ADR 007: Resilient Multi-Engine Fallback, In-Player CORS Proxy Presets & Sub-Request Proxying
- **Context:** IPTV providers stream across disparate container formats (M3U8, MPEG-TS, MP4) and frequently lack CORS headers or use unencrypted `http://` streams that modern browsers block under Mixed Content security rules on HTTPS sites. In addition, when an initial engine (e.g. native HTML5 video or Hls.js) failed on unsupported formats (such as raw MPEG-TS in Chromium), the player previously retried the same failed engine repeatedly instead of progressing down the fallback chain. Furthermore, Hls.js proxies only fetched the master manifest through the proxy while sub-requests for fragments and keys still hit CORS errors.
- **Decision:**
  1. Implement deterministic multi-engine startup fallback in `PlayerManager` (trying `hls` -> `mpegts` -> `native` sequentially before declaring fatal failure).
  2. Implement sub-request proxying in `HlsPlayerEngine` using a custom `Hls.DefaultConfig.loader` extension that ensures fragment, playlist, and key URLs are routed through the configured proxy.
  3. Introduce 1-click CORS proxy presets (`corsproxy.io`, `allorigins`, `codetabs`) selectable both in Settings and directly inside the stream error overlay and diagnostic modal.
  4. Replace expired/403 test streams in the public demo playlist with verified, high-availability public feeds (Deutsche Welle HD, Apple BipBop, Mux adaptive test) and automatic IndexedDB migration.
- **Consequence:** Zero remote-typing friction for TV users encountering CORS/mixed-content errors, seamless format fallback across Chromium/Safari/TV browsers, and 100% working verified demo playback.

