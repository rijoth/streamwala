#!/usr/bin/env python3
"""Generate the Google Play store graphics from the one brand definition.

Usage:  python3 scripts/play-assets.py

Play asks for three fixed-size images per listing, none of which the launcher
icon can be reused for:

| Asset | Size | Play requirement |
| --- | --- | --- |
| `icon.png` | 512x512 | 32-bit PNG, Play masks 30% corners + shadow itself |
| `featureGraphic.png` | 1024x500 | 24-bit PNG, no alpha |
| `tvBanner.png` | 1280x720 | TV listings only, mandatory |

They are rendered from the same constants and the same `draw_glyph` /
`draw_pip` used by `scripts/android-assets.py`, so the store cannot drift into
a second logo (ADR 021 / ADR 032). Python is not available in CI, so the
committed PNGs are the contract and `src/shared/ui/brand/playStoreAssets.test.ts`
fails if they disagree with these sizes or with the listing copy limits.

Screenshots are deliberately *not* generated: Play rejects device frames and
anything that is not the real in-app UI. Capture them from a running build with
`scripts/play-screenshots.sh` and drop them in the same `images/` folder.
"""

from __future__ import annotations

import importlib.util
import pathlib

from PIL import Image, ImageDraw, ImageOps

ROOT = pathlib.Path(__file__).resolve().parent.parent
BRAND_PATH = ROOT / "scripts/android-assets.py"
IMAGES = ROOT / "android/fastlane/metadata/android/en-US/images"

# Load the brand module by path: `scripts/` is not a package and both scripts
# must read the *same* constants object, not a copy.
_spec = importlib.util.spec_from_file_location("streamwala_brand", BRAND_PATH)
if _spec is None or _spec.loader is None:  # pragma: no cover - defensive
    raise SystemExit(f"cannot load the brand module at {BRAND_PATH}")
brand = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(brand)

ICON_SIZE = 512
FEATURE_SIZE = (1024, 500)
TV_BANNER_SIZE = (1280, 720)
# TV banner is also the Play *TV* banner, but it is a 16:9 image: keep the mark
# well inside the safe area so Play's cropping and TV overscan cannot clip it.
FEATURE_MARK = 340
TV_BANNER_MARK = 420
# How strongly the feature graphic lifts off the brand background at the top.
GRADIENT_STRENGTH = 0.38


def blend(top: tuple[int, int, int, int], bottom: tuple[int, int, int, int], t: float) -> tuple[int, ...]:
    return tuple(round(a + (b - a) * t) for a, b in zip(top[:3], bottom[:3]))


def backdrop(width: int, height: int) -> Image.Image:
    """Brand background with a single soft vertical lift.

    One generated gradient instead of hand-tuned per-asset colours: every
    listing image reads as the same material, and re-running this script is
    byte-identical because the maths is deterministic.
    """
    base = Image.new("RGB", (width, height), brand.BACKGROUND[:3])
    lifted = Image.new(
        "RGB",
        (width, height),
        blend(brand.BACKGROUND, brand.ACCENT_DIM, GRADIENT_STRENGTH),
    )
    mask = ImageOps.invert(Image.linear_gradient("L")).resize(
        (width, height), Image.BILINEAR
    )
    return Image.composite(lifted, base, mask)


def paste_mark(image: Image.Image, side: int) -> None:
    mark = brand.render(side, 1.0, bg=None)
    image.paste(mark, ((image.width - side) // 2, (image.height - side) // 2), mark)


def write_icon() -> None:
    """512x512, 32-bit. Full-bleed plate: Play supplies the rounded mask.

    Drawing the plate edge-to-edge avoids the "rounded square inside a rounded
    square" look a smaller plate would produce once Play rounds the corners at
    roughly the same radius the plate itself uses.
    """
    icon = Image.new("RGBA", (ICON_SIZE, ICON_SIZE), brand.ACCENT_DIM)
    draw = ImageDraw.Draw(icon)
    brand.draw_glyph(draw, 0, 0, ICON_SIZE)
    brand.draw_pip(draw, 0, 0, ICON_SIZE)
    icon.save(IMAGES / "icon.png", optimize=True)


def write_feature_graphic() -> None:
    width, height = FEATURE_SIZE
    image = backdrop(width, height)
    paste_mark(image, FEATURE_MARK)
    image.save(IMAGES / "featureGraphic.png", optimize=True)


def write_tv_banner() -> None:
    width, height = TV_BANNER_SIZE
    image = backdrop(width, height)
    paste_mark(image, TV_BANNER_MARK)
    image.save(IMAGES / "tvBanner.png", optimize=True)


def write_screenshot_folders() -> None:
    """Play needs real captures; the folders just give them a home.

    `.gitkeep` keeps the tree in git so the capture script has somewhere to
    write and the layout is obvious to a contributor reading the repository.
    """
    for name in ("phoneScreenshots", "tvScreenshots"):
        folder = IMAGES / name
        folder.mkdir(parents=True, exist_ok=True)
        keep = folder / ".gitkeep"
        if not keep.exists():
            keep.write_text("")


if __name__ == "__main__":
    IMAGES.mkdir(parents=True, exist_ok=True)
    write_icon()
    write_feature_graphic()
    write_tv_banner()
    write_screenshot_folders()
    print("Play store graphics written to", IMAGES)
    print("Capture screenshots with scripts/play-screenshots.sh")
