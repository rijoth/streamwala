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


### ADR 008: Bug-hunt behavioural defaults
- **Context:** The bug-fix pass (see `docs/BUGS.md`) surfaced several places where the existing code was ambiguous or conflicted with the spatial-navigation library. Each needed a safe default rather than a product decision.
- **Decision:**
  1. **BACK is single-dispatch.** The global back-handler stack is driven by exactly one module-level window listener (`dispatchBack()`). Components never pop the stack themselves. This guarantees one layer per key press regardless of how many `useTvInput` instances are mounted.
  2. **Overlays own the D-pad.** When the player controls overlay or the stream-error overlay is visible, NAV_*/SELECT are yielded to the spatial-navigation engine; the player only keeps media/info/digit/color shortcuts. Auto-hide is paused while navigating.
  3. **HLS media recovery is bounded.** `HlsPlayerEngine` attempts in-place recovery twice (`recoverMediaError`, then `swapAudioCodec` + `recoverMediaError`) before reporting fatal. Network errors are never recovered locally: `PlayerManager` alone owns fallback and exponential backoff.
  4. **Async player callbacks are generation-gated.** `PlayerManager` increments a session token per load; stale `init`/error/success callbacks are dropped to protect rapid channel zapping.
  5. **Missing XMLTV `stop` defaults** to `start + 30 minutes` and timezone offsets accept both spaced and compact forms (`+0530`, `+05`).
- **Consequence:** Deterministic remote behaviour (one layer per BACK, one channel action per arrow), no player recovery races, and tolerant EPG ingestion. EPG timeline virtualization (BUG-008) is explicitly deferred: it needs a dedicated windowing + 2-D focus design and is tracked in `docs/BUGS.md`.

### ADR 009: Single lockfile policy (npm)
- **Context:** The repository currently ships two lockfiles — `package-lock.json` (npm, matches the installed `node_modules`) and a stale `bun.lock`. New guardrail tooling (Vitest, Playwright, ESLint) was installed with npm to avoid a third lockfile.
- **Decision:** npm is the single package manager. `package-lock.json` is authoritative. `bun.lock` is stale and should be removed, but is left in place for a separate, explicit cleanup.
- **Consequence:** CI uses `npm ci`. Copies of the older prompts that say `pnpm` should be read as `npm run` / `npx`. The architecture and guardrail docs are [`ARCHITECTURE.md`](./ARCHITECTURE.md) and [`GUARDRAILS.md`](./GUARDRAILS.md).

### ADR 013: Navigation — permanent icon-only rail; labels via aria only; hints moved to content footer
- **Context:** The previous side drawer was `position: fixed` over the content, clipped hero text at the left edge, expanded on hover/focus into a ~256 px labelled panel (wasting ~230 px of a 10-foot screen) and crammed the wordmark plus a colour-key legend into the sidebar. It also relied on the library's inverse boolean polarity for arrow presses (BUG-001 class) and had no active-vs-focused distinction at 3 m.
- **Decision:**
  1. Replace the drawer with a permanent `NavigationRail` that lives **in normal layout flow** (`rail | content` flex row, never `position: fixed`), is exactly `--rail-width` wide and never expands. Content starts at the rail's trailing edge plus the standard safe-area padding, so the drawer's `ml-20` hack is gone.
  2. Icon-only: logo mark (no wordmark/subtitle), Home / Live TV / EPG Guide / Favorites / Search vertically centred, Settings pinned to the bottom. Icons are `<Icon/>` Material Symbols Rounded at `--rail-icon-size`; every item is a `--rail-item-size` square hit target whose accessible name comes from `aria-label` only. Active = `secondary-container` pill + filled icon + `aria-current="page"`; focused = 3 px `--md-sys-color-primary` ring + scale 1.06. Motion is limited to `transform`/`opacity` and honours `prefers-reduced-motion`.
  3. Focus rules live in the `NAV_RAIL` zone and use only `shared/focus` wrappers: LEFT enters on the active item (`preferredChildFocusKey`, `saveLastFocusedChild: false`); UP/DOWN stop at the ends (focus boundary for `left`/`up`/`down` plus `BLOCK_NAVIGATION` sentinels with a one-line reason each); RIGHT restores the last content element remembered by `src/shared/focus/contentFocusMemory.ts`; OK navigates on `onEnterPress` only and lands focus on the new screen's primary target; BACK closes overlays first, then focuses the rail.
  4. `FocusScope` was added to `shared/focus` because `useFocusable` reads its parent from `FocusContext` and the library does **not** provide that context automatically — without it a container's `preferredChildFocusKey`/focus memory is silently ignored (children register against the ROOT).
  5. The colour-key legend moved out of the rail into a slim `RemoteHintBar` at the bottom of the content area, gated by a new persisted `showRemoteHints` setting (default on) and naturally hidden on the player route. The shortcuts themselves are unchanged.
  6. The rail is not rendered on the player, onboarding or other fullscreen routes; pointer clicks still navigate and follow the existing `:focus-visible` behaviour.
- **Consequence:** No content is clipped or overlapped at 1280×720, 1920×1080 or 3840×2160 (asserted in `e2e/navigation-rail.spec.ts`); active and focused states are distinguishable at 3 m; the whole app is D-pad navigable and BACK ordering is preserved. Geometry is documented in [`DESIGN_TOKENS.md`](./DESIGN_TOKENS.md) and focus rules in [`TV_INPUT.md`](./TV_INPUT.md).
