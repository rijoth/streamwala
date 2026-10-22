# Focus-Driven Scrolling (`docs/SCROLLING.md`)

Scrolling in Streamwala is **derived from focus**, not the other way around.
The D-pad moves focus; the scroll offset is computed from the focused item. The
old ad-hoc `scrollIntoView({ behavior: 'smooth', block: 'nearest' })` call on
every focus change is gone (it pinned cards to the screen edge, stacked
animations, and clipped the hero, headings and focus rings).

## Principles

1. **Focus is the source of truth.** Scroll position is a pure function of the
   focused item.
2. **Deterministic.** The same focus target always yields the same offset.
3. **Index math, not hot-path measurement.** Grids and lists derive offsets
   from `index × item size`; never `getBoundingClientRect` while focus moves.
   The one deliberate exception is `useRowSnapScroller`: a page of rows is a
   handful of elements, so it reads the focused row's `offsetTop` once per
   focus change. A cache cannot express the transitions Home actually has (the
   hero collapsing, an EPG/history row inserted above the focused row), and a
   stale cache painted the focused row above the clip viewport (BUG-028).
4. **Layout changes re-anchor.** Anything that moves a row or resizes the
   viewport (which moves the focus line) re-anchors the row that holds focus —
   see `layoutObserver.ts`.
5. **Never queue animations.** A new target retargets the in-flight tween.
6. **Cheap on TV SoCs.** Only `transform`/`opacity` animate. No
   `scroll-behavior: smooth`.

## Module layout (`src/shared/scroll`)

| File | Purpose |
|---|---|
| `config.ts` | `ScrollConfig` tokens + defaults (`focusLine` 0.38, `duration` 220 ms, `repeatThrottleMs` 90, `holdAccelerateAfterMs` 500, `carouselSlot` 1, `overscanRows` 2, …). |
| `math.ts` | **Pure** offset math: clamp, focus line, row snap, carousel slot, minimal scroll, visible range, key-repeat step, M3 emphasized-decelerate easing, retargetable tween. |
| `useScrollAxis.ts` | Transform-based scroll axis: `scrollToOffset` with a retargetable rAF tween, instant mode, `prefers-reduced-motion`, wheel/touch into the same offset model. |
| `ScrollViewport.tsx` | Clipping viewport + transformed content for an axis. |
| `useFocusedItemIndex.ts` | Observes `data-focused="true"` and reports `{ index, row, col, x }`; `readFocusedItem()` is the same read used by the re-anchoring path. |
| `layoutObserver.ts` / `useLayoutSignal.ts` | Layout-change signal: `ResizeObserver` where available, plus `MutationObserver` (rows added/removed, hero class swap) and viewport `resize`/`visualViewport` fallbacks, coalesced to one callback per frame. TV WebViews older than Chromium 64 have no `ResizeObserver`, and a missing observer used to freeze every cached metric (BUG-028). |
| `useItemOffsets.ts` | Cached per-item offsets for the EPG timeline (mount/resize only). |
| `useMeasuredItemHeight.ts` | Layout-pass measurement of the first rendered cell's height, for rem-sized grid/list items. |
| `useVirtualWindow.ts` / `VirtualGrid.tsx` | Windowing driven by the offset for grids/long lists; the content keeps full index-math height so clamping stays correct. |
| `useRowSnapScroller.ts` | Vertical page scroller (Home): focused row top on the focus line, read from the live layout and re-anchored on every layout/viewport change. |
| `useCarouselScroller.ts` | Horizontal fixed-slot carousel. |
| `useGridScroller.ts` | Minimal-scroll grids/lists (including the Live TV category rail, `columns: 1`); derives columns from viewport width. |
| `useStripScroller.ts` | Horizontal strip for variable-width items (filter chips). |
| `useKeyRepeat.ts` | Subscribes to held-key acceleration from `shared/input`. |
| `scrollMemory.ts` / `useScrollRestore.ts` | Per-screen/per-row focus + offset persistence and restore. |
| `ScrollPositionIndicator.tsx` | Non-focusable position track, hidden when the list fits. |

Public API is exported from `src/shared/scroll/index.ts` only.

## HTML contract

- Every scroller item carries the index it should be addressed by:
  - `data-scroll-row={i}` on a full-width row/section (row-snap),
  - `data-scroll-index={i}` on a grid/list card,
  - `data-scroll-col={i}` on a carousel card,
  - `data-scroll-x={px}` on a variable-width cell (timeline).
- Positioned content (`position: relative`) is required for the measurement
  helpers (`offsetTop`/`offsetLeft` are relative to it).
- Add `--focus-ring-pad` (`calc(18 * var(--u))`, ADR 035) padding to scroll
  content so the 3-design-px focus ring and `scale(1.05)` are not clipped by
  `overflow: hidden`. Where padding would change the index-math pitch
  (grids/lists), use `useFocusRingClipStyle()`: it sets `overflow: clip` plus a
  resolved px `overflow-clip-margin`, because Chromium rejects `var()`/`calc()`
  for that property. The ring may paint into the margin, the row math is
  untouched.

## Adding a scrollable screen

1. Pick the scroller: `useRowSnapScroller` (page of rows), `useCarouselScroller`
   (horizontal rail), `useGridScroller` (grid/list, or a single-column vertical
   rail), `useStripScroller`
   (variable-width chips), or `useScrollAxis` (bespoke, e.g. EPG's two axes).
2. Render a clipping viewport (`overflow-hidden`) and a transformed content
   element. `ScrollViewport` does this; `VirtualGrid` owns its content element.
3. Tag items with the `data-scroll-*` attributes above and give every focusable
   a stable `focusKey` (include the row/screen prefix to keep keys unique).
4. Do **not** scroll from your own `onFocus`; the scroller's
   `useFocusedItemIndex` observer already reacts to `data-focused`.
5. For long lists pass `count`/`rowSize` and use `VirtualGrid`; add
   `ScrollPositionIndicator` when the list can exceed the viewport. If item
   heights are authored in rem (so they track the viewer's font size), pass
   `measureItemHeight: true` and use the scroller's returned `itemHeight` /
   `rowSize` for `VirtualGrid` — a hard-coded px height would drift from the
   layout and crop rem-sized text (BUG-022).
6. Avoid putting content above the focused item in a way that shifts it (the
   leading spacer in `VirtualGrid` is a transform, never layout).
7. A filtered grid keeps the VirtualGrid mounted at zero items and overlays its
   empty state, so `contentRef` stays attached to the layout pass. When the
   rendered set changes under focus, use
   `src/features/search/useSearchFocusGuard.ts` to re-anchor a surviving card or
   hand focus back to the search field when the focused card is gone.

## Key repeat

The single window listener in `src/shared/input/useTvInput.ts` owns a NAV repeat
gate: browser auto-repeat is throttled to `repeatThrottleMs`, and past
`holdAccelerateAfterMs` the step grows 1 → 2 → 4. Screens subscribe with
`useKeyRepeat` and jump that many rows; when a listener is present the gate
blocks the engine's single-step move for that keydown so the step is not
double-applied. `PageUp`/`PageDown` (normalised to `CH_UP`/`CH_DOWN`) jump one
viewport of rows; digits quick-jump by channel number.

## Memory

`useScrollRestore` applies the remembered offset first (so the window renders
the row) and then sets focus (next frame if needed). Memory is cleared on
playlist change and falls back to "no focus key" when indices are invalidated.

Two safety rules keep restoration from fighting the viewer:

- **Never move focus out of a text input.** `useScrollRestore` restores the
  offset but skips the focus restore while `document.activeElement` is editable.
  Clearing an inline search query remounts the browse rows; pulling the caret
  out of the field to the remembered card is a bug.
- **Query-derived lists do not restore.** Pass `useGridScroller({ restore:
  false })` (or `useScrollRestore(key, axis, false)`) for a filtered result
  grid. New results always start at the top, and the query is never part of the
  scroller `screenKey` (typing must not re-run the restore effect).

## Pitfalls

- **Never** re-introduce `scrollIntoView` or `scroll-behavior: smooth` outside
  `src/shared/scroll`. `streamwala/no-adhoc-scroll` fails `npm run lint:eslint`.
- Hero state changes must not remount the focused element — toggle classes on a
  single DOM tree (see `HeroSection.tsx`), otherwise DOM focus can drop to
  `<body>`.
- Give `useGridScroller` the real rendered `itemHeight`; a mismatch makes the
  window and the offset model disagree. Rem-sized cards therefore never set a
  px height: they declare a rem `min-height` and the scroller measures the cell.
- Item measurements come from `offsetHeight`, never the bounding rect: the
  focused card's `scale(1.04)` transform must not feed back into the row pitch.
- Do not animate `scrollTop`; animate the content `transform` only.
- Never gate a re-measure on `ResizeObserver` existing. `observeLayoutChanges`
  is the only supported way to learn that the layout moved: it degrades to
  DOM-mutation and viewport signals, and it deliberately ignores the scrolled
  content's own `transform` so a tween cannot re-trigger measurement every
  frame (BUG-028).
- A scroller that re-anchors must read which row *currently* holds focus
  (`readFocusedItem`) instead of trusting the row index of the last focus event:
  inserting a row above the focused one changes that index.

## Not yet migrated

These still rely on native `overflow` and are tracked for a follow-up (they are
outside the named migration milestones): Settings panel/tabs, `SideSheet`,
`OnboardingFlow`, `VirtualKeyboard` preview, the dev-only `GalleryView`, and the
player's `MiniChannelOverlay` (also BUG-021). They contain no `scrollIntoView`.
