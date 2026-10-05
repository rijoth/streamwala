#!/usr/bin/env python3
"""Regenerate Android launcher icons, TV banner and splash screens.

Usage:  python3 scripts/android-assets.py

The web app is the product; these assets are the only bitmap artwork the native
shell ships. Keeping them generated (instead of hand-exported) means the brand
colour stays in sync with `android/app/src/main/res/values/colors.xml`.

Brand: background #0B0C13, plate #1B4578 (M3 primary-container), glyph #A0CAFF
(M3 primary), live pip #D6BDFB (M3 tertiary) — all from src/index.css.
"""

from __future__ import annotations

import math
import pathlib

from PIL import Image, ImageDraw

RES = pathlib.Path(__file__).resolve().parent.parent / "android/app/src/main/res"

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
    cx = left + side / 2
    cy = top + side / 2
    rx = side * GLYPH_RX
    ry = side * GLYPH_RY
    stroke = max(2, int(round(side * GLYPH_STROKE)))
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

    draw.line(points, fill=ACCENT, width=stroke, joint="curve")

    # PIL's thick-line joints leave 1px pinholes where chords meet on a convex
    # curve, and it has no round line caps at all. Stamping a disc at every
    # vertex makes the union an exact round-joined, round-capped stroke.
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


if __name__ == "__main__":
    write_icons()
    write_banner()
    write_splashes()
    write_launcher_background()
    print("Android assets regenerated in", RES)
