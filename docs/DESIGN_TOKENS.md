# Design Tokens (docs/DESIGN_TOKENS.md)

All visual values live as CSS custom properties in `src/index.css` and are
consumed through Tailwind arbitrary values (`bg-[var(--md-sys-color-…)]`) or
inline `style`. Components never hardcode colors, sizes or rems
(AGENTS.md Rule 5). The shared token map is `src/shared/ui/tokens.ts`.

## Color — Material 3 (`--md-sys-color-*`)

Defined in `:root` (dark, default), `html.theme-light` and `html.theme-amoled`.
Per ADR 012 a theme variant restates **every** `--md-sys-color-*` token declared
for dark mode; `src/app/settingsStore.test.ts` enforces this.

| Group | Tokens |
|---|---|
| Primary | `--md-sys-color-primary`, `-on-primary`, `-primary-container`, `-on-primary-container` |
| Secondary | `--md-sys-color-secondary`, `-on-secondary`, `-secondary-container`, `-on-secondary-container` |
| Tertiary | `--md-sys-color-tertiary`, `-on-tertiary`, `-tertiary-container`, `-on-tertiary-container` |
| Surface | `--md-sys-color-surface`, `-surface-dim`, `-surface-bright`, `-surface-container-lowest`, `-surface-container-low`, `-surface-container`, `-surface-container-high`, `-surface-container-highest` |
| Content | `--md-sys-color-on-surface`, `-on-surface-variant`, `-outline`, `-outline-variant` |
| Error | `--md-sys-color-error`, `-on-error`, `-error-container`, `-on-error-container` |
| Focus | `--md-sys-color-focus-ring` |

## Shape (`--md-shape-*`)

`--md-shape-xs|sm|md|lg|xl|full` (4/8/12/16/28/9999 px).

## Layout & 10-foot geometry

| Token | Value | Used by |
|---|---|---|
| `--ui-scale` | `1` (set by `applyTheme` from `settings.uiScale`) | global scale factor |
| `--tv-safe-x` | `48px` (or `16px` when safe padding is off) | `.tv-safe-container` horizontal overscan padding |
| `--tv-safe-y` | `32px` (or `16px` when safe padding is off) | `.tv-safe-container` vertical overscan padding |
| `--rail-width` | `calc(96px * var(--ui-scale))` | permanent navigation rail width (in normal layout flow, never `position: fixed`) |
| `--rail-item-size` | `calc(64px * var(--ui-scale))` | rail destination hit target (≥ 64 px square at 100% scale) |
| `--rail-icon-size` | `calc(32px * var(--ui-scale))` | rail Material Symbols icon size (≈ 32 px at 1080p) |

Changing `settings.uiScale` rewrites `--ui-scale`; everything derived from it
(including the rail) reflows without component branches.

## Remote color-key dots

Physical remote colour keys keep their button colours regardless of theme.
These are used only by the footer hint bar (`RemoteHintBar.tsx`):

| Token | Value |
|---|---|
| `--streamwala-color-key-red` | `#ef4444` |
| `--streamwala-color-key-green` | `#22c55e` |
| `--streamwala-color-key-yellow` | `#eab308` |
| `--streamwala-color-key-blue` | `#3b82f6` |
