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
  `aether/no-raw-key-listeners` error. Verified via `eslint --stdin`.

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
- **Negative proof:** reintroducing `autoFocus` on search results makes
  `SearchView.test.tsx` fail (`expected 'sn:focusable-item-1' to be
  'SEARCH_FIELD'`).

## D. Automated storage proof

- **Prevents:** BUG-004 (orphaned EPG/history), BUG-015 (partial import),
  BUG-016 (raw storage errors), BUG-017 (flags lost on re-sync).
- **Enforcement:** `fake-indexeddb` + `createAetherDatabase(name, options)` give
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
- **Negative proof:** `el.scrollIntoView()` in a feature →
  `aether/no-adhoc-scroll` error. Verified via RuleTester.

## Wiring into CI

`npm run check` runs, in order: `tsc --noEmit` → `eslint src` → Vitest with
coverage thresholds → Playwright Chromium. `.github/workflows/ci.yml` installs
dependencies and the Chromium browser, then runs `npm run check`. Any guardrail
violation fails the job.
