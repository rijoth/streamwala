# Android TV & Smart TV Remote Input Specification (docs/TV_INPUT.md)

## Key Normalization Matrix
The `src/shared/input` module intercepts raw keyboard and remote events and converts them into standardized semantic action events:

| Semantic Action | Input Keys / KeyCodes | Handled In UI |
|---|---|---|
| `NAV_UP` | ArrowUp (38) | Navigate focus upward |
| `NAV_DOWN` | ArrowDown (40) | Navigate focus downward |
| `NAV_LEFT` | ArrowLeft (37) | Navigate focus left / expand rail |
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
