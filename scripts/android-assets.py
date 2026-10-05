#!/usr/bin/env python3
"""Regenerate the brand artwork: Android icons/banner/splashes and the web mark.

Usage:  python3 scripts/android-assets.py

The web app is the product; these assets are the only bitmap artwork the native
shell ships. Keeping them generated (instead of hand-exported) means the brand
colour stays in sync with `android/app/src/main/res/values/colors.xml`.

Brand: background #0B0C13, plate #1B4578 (M3 primary-container), glyph #A0CAFF
(M3 primary), live pip #D6BDFB (M3 tertiary) — all from src/index.css.

This script also writes the web layer's copies of the mark (ADR 022):
`src/shared/ui/brand/streamwala-mark.svg`, `public/favicon.svg`, and the inline
copy between the `streamwala-mark` markers in `index.html`. There is no
hand-pasted copy of the mark anywhere, so the mark cannot drift into two shapes
the way it did before ADR 021. The browser build and CI have no Python at all,
so those committed outputs are the contract and
`src/shared/ui/brand/brandAssets.test.ts` fails if they disagree with the
constants below or with each other.
"""

from __future__ import annotations

import math
import pathlib

from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parent.parent
RES = ROOT / "android/app/src/main/res"
WEB_MARK = ROOT / "src/shared/ui/brand/streamwala-mark.svg"
WEB_FAVICON = ROOT / "public/favicon.svg"
INDEX_HTML = ROOT / "index.html"
INLINE_MARK_START = "<!-- streamwala-mark:start -->"
INLINE_MARK_END = "<!-- streamwala-mark:end -->"

BACKGROUND = (11, 12, 19, 255)
ACCENT_DIM = (27, 69, 120, 255)
ACCENT = (160, 202, 255, 255)
TERTIARY = (214, 189, 251, 255)

# Mark geometry, every value as a fraction of the plate side so the launcher
# icons, splash screens and TV banner cannot drift apart.
PLATE_RADIUS = 0.23
GLYPH_RX = 0.180
GLYPH_RY = 0.125
GLYPH_STROKE = 0.092
PIP_RADIUS = 0.056
PIP_CENTRE = 0.815

# The SVG draws in a 1000-unit plate box, so every fraction above carries over
# unchanged instead of being restated in pixels.
SVG_UNITS = 1000
# Favicon only: the mark covers 86% of the canvas so it does not run into the
# browser's own rounding, and the rest is the brand background.
SVG_FAVICON_INSET = 0.86


def glyph_points(left: float, top: float, side: float) -> list[tuple[float, float]]:
    """The "S" spine as one polyline inside a plate box at `left`/`top`/`side`.

    Shared by the raster and the vector build so the two cannot disagree about
    the shape.
    """
    cx = left + side / 2
    cy = top + side / 2
    rx = side * GLYPH_RX
    ry = side * GLYPH_RY
    steps = 96
    sweep = 3 * math.pi / 2

    points: list[tuple[float, float]] = []

    # Upper bowl: right terminal, over the top, down the left, to the centre.
    for i in range(steps + 1):
        phi = sweep * i / steps
        points.append((cx + rx * math.cos(phi), cy - ry - ry * math.sin(phi)))

    # Lower bowl: centre, out to the right, under the bottom, to the left
    # terminal. The centre point is shared with the upper bowl, so skip it.
    for i in range(1, steps + 1):
        psi = sweep + sweep * i / steps
        points.append((cx + rx * math.cos(psi), cy + ry + ry * math.sin(psi)))

    return points


def draw_glyph(draw: ImageDraw.ImageDraw, left: float, top: float, side: float) -> None:
    """Draw the Streamwala "S" as a stroked path.

    Geometric, not typeset: a font glyph would make the artwork depend on which
    bold TTF happens to be installed, so the assets would stop being
    reproducible (ADR 018).

    The spine is two 270-degree bowls that meet tangentially at the centre: the
    upper bowl opens right, the lower bowl opens left, and both are horizontal
    where they join, so the middle of the S is a smooth band rather than a seam.
    Shapes that look right and are not: half-ellipse bowls joined by a straight
    segment (reads as "Z"), a single-oscillation spine (reads as a slash), and a
    1.5-oscillation cosine spine (reads as a lightning bolt — the reversals are
    instantaneous instead of broad).

    Emitted as one polyline with rounded joints and round terminals, at a stroke
    weight that matches the Material Symbols Rounded icons in the nav rail.
    """
    stroke = max(2, int(round(side * GLYPH_STROKE)))
    points = glyph_points(left, top, side)

    draw.line(points, fill=ACCENT, width=stroke, joint="curve")

    # PIL's thick-line joints leave 1px pinholes where chords meet on a convex
    # curve, and it has no round line caps at all. Stamping a disc at every
    # vertex makes the union an exact round-joined, round-capped stroke. The SVG
    # build gets the same silhouette from stroke-linecap/linejoin="round".
    cap = stroke / 2
    for x, y in points:
        draw.ellipse([x - cap, y - cap, x + cap, y + cap], fill=ACCENT)


def draw_pip(draw: ImageDraw.ImageDraw, left: float, top: float, side: float) -> None:
    """Live pip in M3 tertiary: the one accent that is not a primary tone.

    Kept fully inside the plate (never straddling the rounded corner) so the
    adaptive-icon mask cannot clip it.
    """
    r = side * PIP_RADIUS
    px = left + side * PIP_CENTRE
    py = top + side * PIP_CENTRE
    draw.ellipse([px - r, py - r, px + r, py + r], fill=TERTIARY)


def draw_mark(draw: ImageDraw.ImageDraw, size: int, scale: float) -> None:
    """Draw the Streamwala mark inside a `size` box at `scale` of the box."""
    side = size * scale
    left = (size - side) / 2
    top = (size - side) / 2

    # Rounded plate
    draw.rounded_rectangle(
        [left, top, left + side, top + side],
        radius=side * PLATE_RADIUS,
        fill=ACCENT_DIM,
    )

    draw_glyph(draw, left, top, side)
    draw_pip(draw, left, top, side)


def render(size: int, scale: float, *, bg: tuple[int, int, int, int] | None) -> Image.Image:
    image = Image.new("RGBA", (size, size), bg or (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw_mark(draw, size, scale)
    return image


def write_icons() -> None:
    # Adaptive icon foregrounds: 108dp canvas per density.
    for density, size in {
        "mdpi": 108,
        "hdpi": 162,
        "xhdpi": 216,
        "xxhdpi": 324,
        "xxxhdpi": 432,
    }.items():
        foreground = render(size, 0.62, bg=None)
        foreground.save(RES / f"mipmap-{density}/ic_launcher_foreground.png")

    # Legacy launcher icons (pre-API 26 devices, and Fire TV launchers).
    for density, size in {
        "mdpi": 48,
        "hdpi": 72,
        "xhdpi": 96,
        "xxhdpi": 144,
        "xxxhdpi": 192,
    }.items():
        square = Image.new("RGBA", (size, size), BACKGROUND)
        draw = ImageDraw.Draw(square)
        draw_mark(draw, size, 0.78)
        square.save(RES / f"mipmap-{density}/ic_launcher.png")

        circle = Image.new("RGBA", (size * 4, size * 4), (0, 0, 0, 0))
        ImageDraw.Draw(circle).ellipse(
            [0, 0, size * 4 - 1, size * 4 - 1], fill=BACKGROUND
        )
        circle = circle.resize((size, size), Image.LANCZOS)
        draw = ImageDraw.Draw(circle)
        draw_mark(draw, size, 0.62)
        circle.save(RES / f"mipmap-{density}/ic_launcher_round.png")


def write_banner() -> None:
    """Android TV home-screen banner: required 320x180 safe area.

    The same mark as the launcher icons, so banner, icon, splash and nav-rail
    mark are one shape. No wordmark: the app name lives in the launcher label
    (ADR 019) and the navigation rail is icon-only.
    """
    path = RES / "drawable-nodpi"
    path.mkdir(parents=True, exist_ok=True)
    width, height = 320, 180
    banner = Image.new("RGB", (width, height), BACKGROUND[:3])

    side = 104
    mark = render(side, 1.0, bg=None)
    banner.paste(mark, ((width - side) // 2, (height - side) // 2), mark)

    banner.save(path / "tv_banner.png")


def write_splashes() -> None:
    targets = [
        ("drawable", 480, 320, 0.34),
        ("drawable-land-mdpi", 480, 320, 0.34),
        ("drawable-land-hdpi", 800, 480, 0.30),
        ("drawable-land-xhdpi", 1280, 720, 0.26),
        ("drawable-land-xxhdpi", 1600, 960, 0.24),
        ("drawable-land-xxxhdpi", 1920, 1280, 0.22),
        ("drawable-port-mdpi", 320, 480, 0.34),
        ("drawable-port-hdpi", 480, 800, 0.30),
        ("drawable-port-xhdpi", 720, 1280, 0.26),
        ("drawable-port-xxhdpi", 960, 1600, 0.24),
        ("drawable-port-xxxhdpi", 1280, 1920, 0.22),
    ]
    for folder, width, height, scale in targets:
        image = Image.new("RGB", (width, height), BACKGROUND[:3])
        mark_size = int(min(width, height) * scale * 2)
        if mark_size:
            mark = render(mark_size, 0.8, bg=None)
            image.paste(
                mark,
                ((width - mark_size) // 2, (height - mark_size) // 2),
                mark,
            )
        image.save(RES / folder / "splash.png")


def write_launcher_background() -> None:
    (RES / "values/ic_launcher_background.xml").write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n'
        "<resources>\n"
        '    <color name="ic_launcher_background">#0B0C13</color>\n'
        "</resources>\n"
    )


def hex_color(rgb: tuple[int, int, int, int]) -> str:
    return "#{:02X}{:02X}{:02X}".format(*rgb[:3])


def fmt(value: float) -> str:
    """One decimal, trailing zeros trimmed, so regenerating is byte-identical."""
    return f"{value:.1f}".rstrip("0").rstrip(".")


def svg_document(*, background: tuple[int, int, int, int] | None, inset: float) -> str:
    """The mark as SVG, for the web splash and the favicon.

    `inset` is how much of the canvas the plate covers: the splash mark fills it
    (the CSS sizes it), the favicon leaves a margin so the browser's own
    rounding cannot clip the plate corner.
    """
    side = SVG_UNITS * inset
    offset = (SVG_UNITS - side) / 2
    stroke = max(2, int(round(side * GLYPH_STROKE)))
    points = glyph_points(offset, offset, side)
    path = "M" + " L".join(f"{fmt(x)} {fmt(y)}" for x, y in points)
    pip = offset + side * PIP_CENTRE

    lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SVG_UNITS} {SVG_UNITS}"'
        f' width="{SVG_UNITS}" height="{SVG_UNITS}" aria-hidden="true">',
    ]
    if background is not None:
        lines.append(
            f'  <rect width="{SVG_UNITS}" height="{SVG_UNITS}" fill="{hex_color(background)}"/>'
        )
    lines += [
        f'  <rect x="{fmt(offset)}" y="{fmt(offset)}" width="{fmt(side)}" height="{fmt(side)}"'
        f' rx="{fmt(side * PLATE_RADIUS)}" fill="{hex_color(ACCENT_DIM)}"/>',
        f'  <path d="{path}" fill="none" stroke="{hex_color(ACCENT)}" stroke-width="{fmt(stroke)}"'
        ' stroke-linecap="round" stroke-linejoin="round"/>',
        f'  <circle cx="{fmt(pip)}" cy="{fmt(pip)}" r="{fmt(side * PIP_RADIUS)}"'
        f' fill="{hex_color(TERTIARY)}"/>',
        "</svg>",
    ]
    return "\n".join(lines) + "\n"


def write_inline_svg(mark: str) -> None:
    """Rewrite the inline mark in index.html between its markers.

    index.html cannot import the SVG, and a hand-pasted copy is exactly the
    drift this generator exists to prevent, so the copy is generated too.
    """
    html = INDEX_HTML.read_text()
    start = html.find(INLINE_MARK_START)
    end = html.find(INLINE_MARK_END)
    if start == -1 or end == -1 or end < start:
        raise SystemExit(
            f"index.html is missing the {INLINE_MARK_START} / {INLINE_MARK_END} markers"
        )

    indented = "\n".join(f"        {line}" if line else line for line in mark.splitlines())
    head = html[: start + len(INLINE_MARK_START)]
    tail = html[end:]
    updated = f"{head}\n{indented}\n{tail}"
    if updated != html:
        INDEX_HTML.write_text(updated)


def write_web_brand() -> None:
    """Splash mark, favicon and the inline pre-React copy of the mark."""
    mark = svg_document(background=None, inset=1.0)
    WEB_MARK.parent.mkdir(parents=True, exist_ok=True)
    WEB_MARK.write_text(mark)

    WEB_FAVICON.parent.mkdir(parents=True, exist_ok=True)
    WEB_FAVICON.write_text(svg_document(background=BACKGROUND, inset=SVG_FAVICON_INSET))

    write_inline_svg(mark)


if __name__ == "__main__":
    write_icons()
    write_banner()
    write_splashes()
    write_launcher_background()
    write_web_brand()
    print("Android assets regenerated in", RES)
    print("Web brand written to", WEB_MARK.parent, "and", WEB_FAVICON.parent)
