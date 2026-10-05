# Guardrails

Each guardrail below prevents a bug class found in the audit (see
[`BUGS.md`](./BUGS.md)). They are all wired into `npm run check`, which CI runs.

## A. Type-safe arrow-press decisions

- **Prevents:** BUG-001 (nav-rail focus trap) and the whole "inverted boolean
  polarity" class. The navigation library treats `onArrowPress === false` as
  *block* navigation.
- **Enforcement:** `src/shared/focus/decision.ts` exports branded
  `ALLOW_DEFAULT_NAVIGATION` / `BLOCK_NAVIGATION` sentinels and `ArrowHandler`.
  `useFocusable` only accepts `ArrowHandler`, so raw booleans fail `tsc`.
  A throwing handler is treated as *allow*, so focus can never wedge.
- **Extend:** never widen `ArrowHandler` to `boolean`. New handling logic goes in
  a handler returning a sentinel; add a case to `decision.test.ts`.
- **Negative proof:** `onArrowPress: () => false` → `TS2322: Type '() => boolean'
  is not assignable to type 'ArrowHandler'`.

## B. Single owner of raw key events

- **Prevents:** BUG-002 (BACK double-dispatch from duplicate listeners).
- **Enforcement:** `eslint-rules/no-raw-key-listeners.mjs` (custom rule) rejects
  `addEventListener('keydown' | 'keyup' | 'keypress', ...)` on `window`,
  `document`, `document.body`, `globalThis`, `self` and bare global calls,
  including non-literal event names. `no-restricted-syntax` rejects JSX
  `onKeyDown` / `onKeyUp` / `onKeyPress`. Exactly two files are allow-listed:
  `src/shared/input/useTvInput.ts` and `src/shared/ui/TextField.tsx`. No autofix.
- **Extend:** route new keyboard concerns through `src/shared/input`
  (`useTvInput`, `pushBackHandler`/`dispatchBack`). If a new primitive genuinely
  needs a raw listener, add it to the allowlist deliberately and to the rule's
  RuleTester cases.
- **Negative proof:** `window.addEventListener('keydown', () => {})` →
  `streamwala/no-raw-key-listeners` error. Verified via `eslint --stdin`.

## C. Component + browser regression tests

- **Prevents:** BUG-003 (search focus stolen) and BUG-013 (overlay D-pad
  conflict); surfaced BUG-014 (missing `scrollIntoView` guard).
- **Enforcement:** Vitest + jsdom + Testing Library for non-geometric behaviour
  with a **coverage ratchet** on `shared/focus`, `shared/input`, `features`
  (`vitest.config.ts`); Playwright (Chromium) `e2e/dpad.spec.ts` for real D-pad
  traversal; AGENTS Rule 9 requires a component or e2e test for UI fixes.
- **Extend:** put non-geometric tests next to the code (`*.test.tsx`) using
  `renderWithProviders`, `pressKey`, `expectFocused` from `src/test`. Put any
  geometry-dependent behaviour in `e2e/`. Raise, never lower, the coverage
  thresholds once coverage improves.
- **Focus guardrail (BUG-020):** `e2e/dpad.spec.ts` asserts that after every
  arrow press on every top-level screen the engine cursor
  (`[data-focused="true"]`) exists and carries `tv-focus-target`, and
  `e2e/settings-dpad.spec.ts` does the same while walking the settings screen,
  including OK activation. This is what catches a screen that is technically
  "navigable" but silently stops on non-interactive containers (the previous
  test only checked `document.activeElement`, which a click leaves on the rail).
- **Splash guardrail (ADR 022):** a warm reload paints Home while the boot
  splash still owns input, so D-pad keys pressed in that window are dropped and
  focus silently stays where the previous spec left it. Specs that act on the
  first frame after a `goto`/`reload` must `await waitForAppReady(page)`
  (`e2e/helpers.ts`) instead of waiting on a content sentinel — that mismatch
  made `e2e/navigation-rail.spec.ts` fail intermittently under full-suite load.
- **Negative proof:** reintroducing `autoFocus` on search results makes
  `SearchView.test.tsx` fail (`expected 'sn:focusable-item-1' to be
  'SEARCH_FIELD'`).

## D. Automated storage proof

- **Prevents:** BUG-004 (orphaned EPG/history), BUG-015 (partial import),
  BUG-016 (raw storage errors), BUG-017 (flags lost on re-sync).
- **Enforcement:** `fake-indexeddb` + `createStreamwalaDatabase(name, options)` give
  each test an isolated database; repository/parser functions accept an optional
  handle. `db.test.ts` proves cascade delete, reopen preservation and error
  mapping; `m3uParser.persistence.test.ts` proves import atomicity;
  `demoPlaylist.test.ts` proves flag preservation. AGENTS Rule 10 requires a new
  schema version + upgrade function + migration test for any schema change.
- **Extend:** add a case to `db.test.ts` for each new table/relationship; keep
  schema-version fixtures in `src/test/fixtures/db/` when a v2 migration lands.
- **Negative proof:** removing the programs cascade from `deletePlaylist` makes
  `db.test.ts` fail (`expected 1 to be +0`).

## E. Focus-driven scrolling only

- **Prevents:** edge-pinned focus, stacked smooth-scroll animations, clipped
  hero/headings/rings and unvirtualized long lists (the class removed by
  ADR 015).
- **Enforcement:** `eslint-rules/no-adhoc-scroll.mjs` (custom rule) rejects
  `*.scrollIntoView(...)` calls and `scroll-behavior: smooth` /
  `scroll-smooth` strings outside `src/shared/scroll/**`. Scroll offsets come
  from `src/shared/scroll` index math and animate `transform`.
  `e2e/scroll.spec.ts` asserts the focused element (ring included) stays inside
  its clipping container on a 10k-channel fixture, that Home hero states toggle
  without clipping, that a 3 s held key settles without a queued tween, and that
  the player restores the exact card and offset at 720p/1080p/4K.
- **Extend:** add a scroller hook for new layouts (see
  [`SCROLLING.md`](./SCROLLING.md)); never reintroduce `scrollIntoView`. Add a
  RuleTester case for new banned APIs.
- **Item-size guardrail (BUG-022):** a virtualized cell must never carry a
  hard-coded px height — its contents are rem-sized, so the viewer's font size
  decides the real row pitch. Declare a rem `min-height` and pass
  `measureItemHeight: true` to `useGridScroller`, then use the returned
  `itemHeight`/`rowSize`. `e2e/channel-cards.spec.ts` renders the channel grid
  at 16/20/24 px root font sizes and fails if a name/group line box is clipped
  or if the scroller's content height is not an exact multiple of the real row
  pitch (which would desync the window from the offset model).
- **Negative proof:** re-adding `style={{ height: 208 }}` to `ChannelGridCard`
  fails `e2e/channel-cards.spec.ts` at a 20 px root font size (measured line
  boxes collapse to 0 px).
- **Negative proof:** `el.scrollIntoView()` in a feature →
  `streamwala/no-adhoc-scroll` error. Verified via RuleTester.

## F. Stream transport policy (proxy is a fallback)

- **Prevents:** BUG-023 and BUG-024 — a persisted CORS proxy applied to every
  URL, so a proxy that was down, rate-limited or blocklisting the provider broke
  every channel, the EPG refresh and the playlist import, including origins that
  already return `Access-Control-Allow-Origin`.
- **Enforcement:** `src/domain/transport.ts` owns the policy as a pure function
  (`planTransports`, `applyProxyTemplate`, `canProxyUrl`, `isProxiableUrl`);
  `PlayerManager` must not build a proxied URL itself, and every non-player
  proxy-aware request goes through `src/services/net/transportFetch.ts`, which
  applies the same plan and records the working transport in
  `src/services/net/transportMemory.ts` (session-only).
  `src/domain/transport.test.ts` pins the plan for every case (no proxy, proxy
  configured, mixed content, malformed template, `data:`/`blob:` URL, remembered
  transport), `src/services/net/transportFetch.test.ts` pins the fetch behaviour
  (direct-only, fallback on rejection and on 401/403/407/429/5xx, no fallback on
  404, per-attempt timeout, abort stops retries, memory reuse) and
  `e2e/transport-policy.spec.ts` drives the real app over routed streams and
  playlists: with a dead proxy the origin is fetched directly and the proxy is
  never touched, including during a playlist import; with an unreachable origin
  the direct attempt happens first and the proxy takes over.
- **Extend:** new transport decisions go into `planTransports` with a unit case;
  a new proxy preset must not introduce a code path that bypasses the plan —
  any new fetch that takes `proxyTemplate` must call
  `fetchWithTransportFallback`, never `template.replace('{url}', …)`.
- **Negative proof:** making `planTransports` proxy-first fails 10 unit tests,
  both `src/services/epg/fetcher.test.ts` transport-policy cases, and all three
  `e2e/transport-policy.spec.ts` specs (`Received array: ["proxied", …]`).

## Wiring into CI

`npm run check` runs, in order: `tsc --noEmit` → `eslint src` → Vitest with
coverage thresholds → Playwright Chromium. `.github/workflows/ci.yml` installs
dependencies and the Chromium browser, then runs `npm run check`. Any guardrail
violation fails the job.

`.github/workflows/release.yml` runs the same gate on a `v*` tag before it builds
or publishes anything, so a tagged commit cannot ship without passing here. It
then verifies the artifacts too: `apksigner` rejects a debug-signed APK, and
`aapt2 dump badging` pins each flavour's launcher and `uses-feature` identity
plus the tag's `versionCode`/`versionName`. See `docs/RELEASING.md`.
