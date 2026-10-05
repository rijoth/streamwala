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

## Brand mark

`scripts/android-assets.py` is the single source of the mark. It is generated,
never hand-exported, so the launcher icons, adaptive foregrounds, splash screens
and the 320×180 TV banner cannot drift apart (ADR 018, ADR 021). Geometry is
expressed as fractions of the plate side so one set of numbers covers every
density:

| Constant | Value | Role |
|---|---|---|
| `PLATE_RADIUS` | `0.23` | rounded plate corner, of the plate side |
| `GLYPH_RX` / `GLYPH_RY` | `0.180` / `0.125` | "S" bowl radii |
| `GLYPH_STROKE` | `0.092` | "S" stroke weight |
| `PIP_RADIUS` | `0.056` | live pip radius |
| `PIP_CENTRE` | `0.815` | pip centre, per axis, of the plate side |

Colors are the M3 tokens above and nothing else: plate
`--md-sys-color-primary-container` (`#1B4578`), glyph `--md-sys-color-primary`
(`#A0CAFF`), pip `--md-sys-color-tertiary` (`#D6BDFB`). Contrast is 5.71:1
glyph-on-plate and 5.78:1 pip-on-plate; the pip never touches the glyph, since
tertiary-on-primary is 1.01:1. The two are held at least 9% of the plate side
apart, which is ~4.8px at the smallest rendered size (the 48px legacy launcher
icon); the first geometry tried left only 3.6%, i.e. 1.7px, and the pip read as
part of the glyph. A negative-space play aperture is deliberately not used — a
hole through the plate is only 2.02:1 and vanishes at small sizes.

The "S" is drawn as two 270° elliptical bowls meeting tangentially at the
centre, not typeset, so the assets stay reproducible without an installed font.

The same generator also writes the web layer's copies of the mark (ADR 022):
`src/shared/ui/brand/streamwala-mark.svg` for the boot splash, `public/favicon.svg`
for the tab icon, and the inline copy between the `streamwala-mark` markers in
`index.html`, which paints before any script has run. Neither copy is hand-pasted
— the generator rewrites the inline one. The SVG renders in a 1000-unit plate box
so the fractions above carry over unchanged, and it asks for
`stroke-linecap`/`stroke-linejoin="round"` where the raster build has to stamp a
disc into every vertex (ADR 021 item 6). Regenerating everything is
`npm run android:assets`; `src/shared/ui/brand/brandAssets.test.ts` fails if a
committed copy drifts from these constants or from another copy, since the browser
build and CI have no Python at all.

The boot splash renders the mark at `--brand-mark-size` (`35vmin`, i.e. 0.35 of
the shorter viewport side) — the bottom of the native splash's 0.35–0.54 range,
matching its densest TV bucket, so the mark does not visibly resize when the
native splash hands over to the web one.

## Remote color-key dots

Physical remote colour keys keep their button colours regardless of theme.
These are used only by the footer hint bar (`RemoteHintBar.tsx`):

| Token | Value |
|---|---|
| `--streamwala-color-key-red` | `#ef4444` |
| `--streamwala-color-key-green` | `#22c55e` |
| `--streamwala-color-key-yellow` | `#eab308` |
| `--streamwala-color-key-blue` | `#3b82f6` |
