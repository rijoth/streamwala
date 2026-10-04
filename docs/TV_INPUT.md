# Android TV & Smart TV Remote Input Specification (docs/TV_INPUT.md)

## Key Normalization Matrix
The `src/shared/input` module intercepts raw keyboard and remote events and converts them into standardized semantic action events:

| Semantic Action | Input Keys / KeyCodes | Handled In UI |
|---|---|---|
| `NAV_UP` | ArrowUp (38) | Navigate focus upward |
| `NAV_DOWN` | ArrowDown (40) | Navigate focus downward |
| `NAV_LEFT` | ArrowLeft (37) | Move focus left; from the leftmost content element, enters the navigation rail |
| `NAV_RIGHT` | ArrowRight (39) | Navigate focus right |
| `SELECT` | Enter (13), NumpadEnter, DPAD_CENTER, Space (non-input) | Activate focused item |
| `BACK` | Escape (27), Backspace (outside input), Android Back (4), Tizen (10009), webOS (461) | Close overlay / back navigation |
| `PLAY_PAUSE` | MediaPlayPause (179), MediaPlay (415), MediaPause (19), KeyK | Toggle stream playback |
| `STOP` | MediaStop (413) | Stop playback |
| `SEEK_FWD` | MediaFastForward (417), MediaTrackNext, KeyL | Jump +10s / +30s |
| `SEEK_REW` | MediaRewind (412), MediaTrackPrevious, KeyJ | Jump -10s / -30s |
| `CH_UP` | ChannelUp (427), PageUp (33) | Next channel |
| `CH_DOWN` | ChannelDown (428), PageDown (34) | Previous channel |
| `INFO` | ContextMenu (93), KeyM, KeyI, Info (457), Android Menu (82) | Toggle nerd stats / Now-Next banner |
| `DIGIT_0..9` | Key0–Key9 (48–57), Numpad0–9 (96–105) | Number zap buffer with 2s commit |
| `COLOR_RED` | Key 403 / KeyR | Shortcut: Toggle Favorites |
| `COLOR_GREEN` | Key 404 / KeyG | Shortcut: Open EPG Guide |
| `COLOR_YELLOW` | Key 405 / KeyY | Shortcut: Open Search |
| `COLOR_BLUE` | Key 406 / KeyB | Shortcut: Open Settings |

## Remote Focus Guidelines
- Outer focus ring uses `--md-sys-color-focus-ring` (3px outline or box-shadow + scale 1.05).
- Visible from 3 meters distance on 1080p and 4K displays.
- Long press on OK (holding > 600ms) triggers channel context actions (Favorite / Hide / Details).
- Overscan safe zones: `padding: 32px 48px`.

## Navigation Rail Focus Rules
The rail (`src/shared/ui/NavigationRail.tsx`) is a permanent, icon-only Material
3 rail in normal layout flow. It owns the focus zone `NAV_RAIL` and its items own
`NAV_<destinationId>` keys.

- **LEFT** from the leftmost content element enters the rail on the **active**
  destination (the zone sets `preferredChildFocusKey` to the active item and
  `saveLastFocusedChild: false`), never on the last visited item.
- **RIGHT** exits the rail back to the last-focused content element, remembered
  by `src/shared/focus/contentFocusMemory.ts` (the shell records the current key
  on every remote press while focus is in content). If nothing is remembered the
  engine falls back to the nearest/primary content target.
- **UP / DOWN** move between rail items and stop at the ends: no wrap and no
  leaking into content. The rail is a focus boundary for `left`/`up`/`down`, and
  items additionally return `BLOCK_NAVIGATION` at the first/last item.
- **OK** navigates on `onEnterPress` only (never on focus). OK on the already
  active destination is a no-op that moves focus into the screen content.
- **BACK** first closes any dialog/sheet/menu (they stack above the rail's
  handler). With no overlay open and focus in content it focuses the rail;
  while the rail is focused it defers to the existing exit behaviour.
- Changing destinations lands focus on the new screen's primary target, not on
  the rail.
- The rail renders no text labels: each item is announced through `aria-label`
  and the active item carries `aria-current="page"`.

## Arrow-Press Decisions (type-safe)
The underlying spatial-navigation library uses **inverted boolean polarity** for
`onArrowPress`: returning `false` *blocks* the default focus move, while `true`
(or omitting the handler) allows it. Returning raw booleans is therefore banned.

Use the branded sentinels from `src/shared/focus` instead:

```ts
import { useFocusable, ALLOW_DEFAULT_NAVIGATION, BLOCK_NAVIGATION } from '@/shared/focus';

useFocusable({
  onArrowPress: (direction) => {
    if (direction === 'left' && sheetIsOpen) {
      return BLOCK_NAVIGATION; // keep focus inside the sheet
    }
    return ALLOW_DEFAULT_NAVIGATION;
  },
});
```

Rules:
- A missing handler allows navigation (the default).
- Only return `BLOCK_NAVIGATION` when you have a concrete reason and add a
  one-line comment explaining why.
- A handler that throws is treated as "allow" so focus can never wedge.
- `Raw boolean` returns fail typechecking; `npm run check` enforces it.

Regression coverage: `src/shared/focus/decision.test.ts` (including
`@ts-expect-error` compile-time guards against boolean returns).

## Single Owner of Key Events
All keyboard input is owned by `src/shared/input`. Registering raw listeners
elsewhere caused the BACK double-dispatch bug (BUG-002), so it is banned:

- `aether/no-raw-key-listeners` (custom ESLint rule) rejects
  `addEventListener('keydown' | 'keyup' | 'keypress', ...)` on `window`,
  `document`, `document.body`, `globalThis`, `self`, and bare global calls.
  It also rejects non-literal event names (variables/templates) because they
  cannot be proven safe. There is no autofix.
- `no-restricted-syntax` rejects JSX `onKeyDown` / `onKeyUp` / `onKeyPress`.
- Exactly two files are allow-listed: `src/shared/input/useTvInput.ts` (owns
  the window listener) and `src/shared/ui/TextField.tsx` (needs the native
  input's `onKeyDown` for Enter-to-submit). No wildcard overrides.
- Listeners on ordinary elements (e.g. the `<video>` element in
  `PlayerEngine.ts`) are intentionally out of scope.

Import: these rules only apply to `src/**`. `npm run check` runs ESLint after
`tsc`, so a violation fails CI. Rule unit tests live in
`eslint-rules/no-raw-key-listeners.test.mjs`.
