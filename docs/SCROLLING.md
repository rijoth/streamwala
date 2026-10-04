# Focus-Driven Scrolling (`docs/SCROLLING.md`)

Scrolling in Aether IPTV is **derived from focus**, not the other way around.
The D-pad moves focus; the scroll offset is computed from the focused item. The
old ad-hoc `scrollIntoView({ behavior: 'smooth', block: 'nearest' })` call on
every focus change is gone (it pinned cards to the screen edge, stacked
animations, and clipped the hero, headings and focus rings).

## Principles

1. **Focus is the source of truth.** Scroll position is a pure function of the
   focused item.
2. **Deterministic.** The same focus target always yields the same offset.
3. **Index math, not hot-path measurement.** Offsets come from
   `index × item size` (or cached layout metrics measured on mount/resize).
   Never `getBoundingClientRect` while focus moves.
4. **Never queue animations.** A new target retargets the in-flight tween.
5. **Cheap on TV SoCs.** Only `transform`/`opacity` animate. No
   `scroll-behavior: smooth`.

## Module layout (`src/shared/scroll`)

| File | Purpose |
|---|---|
| `config.ts` | `ScrollConfig` tokens + defaults (`focusLine` 0.38, `duration` 220 ms, `repeatThrottleMs` 90, `holdAccelerateAfterMs` 500, `carouselSlot` 1, `overscanRows` 2, …). |
| `math.ts` | **Pure** offset math: clamp, focus line, row snap, carousel slot, minimal scroll, visible range, key-repeat step, M3 emphasized-decelerate easing, retargetable tween. |
| `useScrollAxis.ts` | Transform-based scroll axis: `scrollToOffset` with a retargetable rAF tween, instant mode, `prefers-reduced-motion`, wheel/touch into the same offset model. |
| `ScrollViewport.tsx` | Clipping viewport + transformed content for an axis. |
| `useFocusedItemIndex.ts` | Observes `data-focused="true"` and reports `{ index, row, col, x }`. |
| `useRowMetrics.ts` / `useItemOffsets.ts` | Cached layout metrics (mount/resize only). |
| `useVirtualWindow.ts` / `VirtualGrid.tsx` | Windowing driven by the offset for grids/long lists; the content keeps full index-math height so clamping stays correct. |
| `useRowSnapScroller.ts` | Vertical page scroller (Home): focused row top on the focus line. |
| `useCarouselScroller.ts` | Horizontal fixed-slot carousel. |
| `useGridScroller.ts` | Minimal-scroll grids/lists; derives columns from viewport width. |
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
- Add `--focus-ring-pad` (10 px) padding to scroll content so the 3 px focus
  ring and `scale(1.04+)` are not clipped by `overflow: hidden`.

## Adding a scrollable screen

1. Pick the scroller: `useRowSnapScroller` (page of rows), `useCarouselScroller`
   (horizontal rail), `useGridScroller` (grid/list), `useStripScroller`
   (variable-width chips), or `useScrollAxis` (bespoke, e.g. EPG's two axes).
2. Render a clipping viewport (`overflow-hidden`) and a transformed content
   element. `ScrollViewport` does this; `VirtualGrid` owns its content element.
3. Tag items with the `data-scroll-*` attributes above and give every focusable
   a stable `focusKey` (include the row/screen prefix to keep keys unique).
4. Do **not** scroll from your own `onFocus`; the scroller's
   `useFocusedItemIndex` observer already reacts to `data-focused`.
5. For long lists pass `count`/`rowSize` and use `VirtualGrid`; add
   `ScrollPositionIndicator` when the list can exceed the viewport.
6. Avoid putting content above the focused item in a way that shifts it (the
   leading spacer in `VirtualGrid` is a transform, never layout).

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

## Pitfalls

- **Never** re-introduce `scrollIntoView` or `scroll-behavior: smooth` outside
  `src/shared/scroll`. `aether/no-adhoc-scroll` fails `npm run lint:eslint`.
- Hero state changes must not remount the focused element — toggle classes on a
  single DOM tree (see `HeroSection.tsx`), otherwise DOM focus can drop to
  `<body>`.
- Give `useGridScroller` the real rendered `itemHeight`; a mismatch makes the
  window and the offset model disagree.
- Do not animate `scrollTop`; animate the content `transform` only.

## Not yet migrated

These still rely on native `overflow` and are tracked for a follow-up (they are
outside the named migration milestones): Settings panel/tabs, `SideSheet`,
`OnboardingFlow`, `VirtualKeyboard` preview, the dev-only `GalleryView`, and the
player's `MiniChannelOverlay` (also BUG-021). They contain no `scrollIntoView`.
