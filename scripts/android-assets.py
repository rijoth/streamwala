#!/usr/bin/env python3
"""Regenerate Android launcher icons, TV banner and splash screens.

Usage:  python3 scripts/android-assets.py

The web app is the product; these assets are the only bitmap artwork the native
shell ships. Keeping them generated (instead of hand-exported) means the brand
colour stays in sync with `android/app/src/main/res/values/colors.xml`.

Brand: background #0B0C13, accent #A0CAFF (M3 primary from src/index.css).
"""

from __future__ import annotations

import pathlib

from PIL import Image, ImageDraw, ImageFont

RES = pathlib.Path(__file__).resolve().parent.parent / "android/app/src/main/res"

BACKGROUND = (11, 12, 19, 255)
ACCENT = (160, 202, 255, 255)
ACCENT_DIM = (27, 69, 120, 255)

FONT_CANDIDATES = [
    "/usr/share/fonts/noto/NotoSans-Bold.ttf",
    "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]


def load_font(size: int) -> ImageFont.FreeTypeFont:
    for candidate in FONT_CANDIDATES:
        path = pathlib.Path(candidate)
        if path.exists():
            return ImageFont.truetype(str(path), size)
    raise SystemExit("No bold TTF font found; install dejavu or liberation fonts.")


def draw_mark(draw: ImageDraw.ImageDraw, size: int, scale: float) -> None:
    """Draw the play/tower mark inside a `size` box at `scale` of the box."""
    side = size * scale
    left = (size - side) / 2
    top = (size - side) / 2

    # Rounded plate
    radius = side * 0.22
    draw.rounded_rectangle(
        [left, top, left + side, top + side], radius=radius, fill=ACCENT_DIM
    )

    # Play triangle
    tri_h = side * 0.42
    tri_w = tri_h * 0.86
    cx, cy = size / 2, size / 2
    draw.polygon(
        [
            (cx - tri_w / 2, cy - tri_h / 2),
            (cx - tri_w / 2, cy + tri_h / 2),
            (cx + tri_w / 2, cy),
        ],
        fill=ACCENT,
    )


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
    """Android TV home-screen banner: required 320x180 safe area."""
    path = RES / "drawable-nodpi"
    path.mkdir(parents=True, exist_ok=True)
    width, height = 320, 180
    banner = Image.new("RGB", (width, height), BACKGROUND[:3])
    draw = ImageDraw.Draw(banner)

    draw.rounded_rectangle([16, 46, 104, 134], radius=18, fill=ACCENT_DIM)
    draw.polygon([(48, 68), (48, 112), (84, 90)], fill=ACCENT)

    font = load_font(34)
    draw.text((120, 74), "Aether", font=font, fill=ACCENT)
    font_small = load_font(18)
    draw.text((121, 112), "IPTV", font=font_small, fill=(226, 226, 236))

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
