# Architecture (as-built)

This describes the code as it exists today. For the reasoning behind it see
[`DECISIONS.md`](./DECISIONS.md); for contribution rules see
[`../AGENTS.md`](../AGENTS.md).

## Layers

```
src/
  main.tsx        entry: initialises the focus engine, mounts <App/>
  App.tsx         app shell: loads DB state, owns activeNavId + playingChannel
  app/            settings store (Zustand) + theme application
  domain/         pure types, Zod schemas, pure helpers (no React, no I/O)
  services/       I/O adapters: storage (Dexie), player engines, playlist/EPG parsers
  features/       screen-level features (onboarding, live-tv, guide, vod, player, ...)
  shared/         reusable primitives: ui (M3), focus, input, icons, hooks
  test/           test-only utilities (renderWithProviders, pressKey, expectFocused)
e2e/              Playwright Chromium D-pad specs
eslint-rules/     custom ESLint guardrail rules + RuleTester tests
```

Dependency direction is one-way: `app -> features -> services / shared -> domain`.
Domain never imports React or performs I/O. Cross-feature imports only via a
feature's `index.ts` barrel.

## Navigation, focus and input

- **Navigation is in-app state, not the router.** `App.tsx` keeps
  `activeNavId` and `playingChannel`. `react-router-dom` is a dependency and is
  used by the test provider, but the running app does not route through it yet.
- **Focus** lives in `src/shared/focus`. `useFocusable` / `FocusZone` wrap
  `@noriginmedia/norigin-spatial-navigation`; arrow decisions use the branded
  `ALLOW_DEFAULT_NAVIGATION` / `BLOCK_NAVIGATION` sentinels (`decision.ts`).
  Features and `app` never import the navigation library directly.
- **Input** lives in `src/shared/input`. `normalizeKeyEvent` maps keyboard and
  TV-remote codes to semantic actions; `useTvInput` is the single owner of
  keyboard events; a module-level listener owns the BACK stack. The same owner
  throttles held NAV repeats and reports accelerated steps to screens.
- **Scrolling** lives in `src/shared/scroll`. Scroll position is derived from the
  focused item's `data-scroll-*` index (index math) and applied as a `transform`
  by a retargetable rAF tween. `useFocusable` never scrolls. See
  [`SCROLLING.md`](./SCROLLING.md) and ADR 015.

## Data and storage

- **Persistent data** is Dexie/IndexedDB (`services/storage/db.ts`), schema v1:
  `playlists`, `channels`, `groups`, `programs`, `history`. Paths are always
  derived (EPG/history cascade from channels). Repository functions accept an
  optional database handle so tests run isolated databases; the app uses the
  singleton `db`.
- **Settings** are small and live in `localStorage` via the Zustand store in
  `app/settingsStore.ts`.
- **Playlists** are parsed in `services/playlist` (M3U, Xtream, demo) and EPG in
  `services/epg/xmltvParser.ts`. Import writes are transactional.

## Playback

- `services/player/PlayerManager.ts` picks an engine order and owns fallback,
  backoff and a per-session generation token. Engines (`hls.js`, `mpegts.js`,
  native `<video>`) implement the `PlayerEngine` interface in
  `services/player/PlayerEngine.ts`.
- `features/player/PlayerView.tsx` renders the video surface and overlays; when
  an overlay owns focus, D-pad navigation is yielded to the focus engine
  (`dpadOverlayPolicy.ts`).

## Testing

- **Vitest + jsdom + Testing Library** cover non-geometric behaviour (focus
  keys, BACK ordering, input normalization, storage). Utilities in `src/test/`.
- **Playwright (Chromium)** covers geometry-dependent D-pad traversal.
- `npm run check` = `tsc --noEmit` + ESLint + Vitest coverage thresholds +
  Playwright. See [`GUARDRAILS.md`](./GUARDRAILS.md).
