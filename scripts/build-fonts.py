#!/usr/bin/env python3
"""Regenerate the self-hosted webfonts and the static brand glyph.

WHY THIS EXISTS (ADR 036)
-------------------------
`index.html` used to load all three faces from `fonts.googleapis.com` with
`display=swap`. Material Symbols is a *ligature* icon font: the DOM contains
the literal words `live_tv`, `arrow_forward`, `search`, and only the font's
`rlig` lookups turn those words into glyphs. With `font-display: swap` the
browser paints the fallback words first and patches them later, so every cold
start flashed raw icon names for as long as the font took to arrive — and the
upstream variable file is 5.4 MB, which on TV hardware is seconds. If the CDN
was unreachable (offline APK, captive portal) the words *never* became icons.

The fix is threefold and all of it is generated here:

1. `public/fonts/material-symbols-rounded.woff2` — the icon font subset to the
   glyphs this repo actually names (`ICON_NAMES`), served locally and declared
   with `font-display: block`, so a glyph box is reserved and the fallback
   *text* is never painted.
2. `public/fonts/*-latin.woff2` — Plus Jakarta Sans and Roboto Flex, latin
   subset only, `font-display: swap`. Text has no ligature contract, so a swap
   there is invisible; shipping them locally is what makes the APK offline.
3. `src/shared/icons/glyphPaths.generated.ts` — the outline for the few
   brand-scale marks (`STATIC_GLYPHS`) baked into an inline SVG path, so the
   56/140 px surfaces never depend on a font at all.

Usage
-----
    npm run fonts            # regenerate everything (needs fonttools + network
                             # on first run; downloaded sources are cached in
                             # .font-cache/, which is gitignored)

`src/shared/icons/iconFont.test.ts` is the drift guard: it fails when a
component starts using an icon this script did not subset, when the committed
woff2 is replaced by hand, or when `index.html` regains a CDN font link.

Requires: Python 3.9+ and fonttools (>= 4.40) with brotli for woff2 output.
"""

from __future__ import annotations

import hashlib
import json
import re
import shutil
import subprocess
import sys
import urllib.parse
import urllib.request
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
CACHE = ROOT / ".font-cache"
FONTS = ROOT / "public" / "fonts"
FONTS_CSS = SRC / "fonts.css"
GLYPH_PATHS_TS = SRC / "shared" / "icons" / "glyphPaths.generated.ts"
MANIFEST = SRC / "shared" / "icons" / "icon-font.json"

CSS_API = "https://fonts.googleapis.com/css2"
# A modern desktop UA, so Google serves woff2 instead of ttf/woff.
UA = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

ICON_FAMILY = "Material Symbols Rounded"
ICON_SLUG = "material-symbols-rounded"
ICON_QUERY = (
    "family=Material+Symbols+Rounded"
    ":opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
)

# Text faces. Only the latin subset is shipped: the UI copy is English, and a
# missing glyph falls back to the system stack exactly like it does today.
TEXT_FAMILIES = (
    {
        "family": "Plus Jakarta Sans",
        "slug": "plus-jakarta-sans",
        "query": "family=Plus+Jakarta+Sans:wght@400..700",
    },
    {
        "family": "Roboto Flex",
        "slug": "roboto-flex",
        "query": "family=Roboto+Flex:opsz,wght@8..144,300..700",
    },
)

# Marks that must never depend on a webfont: the onboarding plate (56 px) and
# the home hero watermark (140 px) are the largest glyphs in the app, so a
# late font on a TV made them read as raw words for seconds (the reported bug).
STATIC_GLYPHS = ("live_tv",)

# `Icon` renders this when a name resolves to nothing, so it must always be in
# the subset. Note that it is `help`, not `help_outline`: current Material
# Symbols renamed the glyph, which is exactly why the old fallback shipped as
# literal text.
ALWAYS_INCLUDE = ("help",)

# Axes the app keeps live. FILL is toggled by `filled`, wght by `weight`.
KEPT_AXES = ("FILL", "wght")

# Glyph names that can be typed as text: letters, digits and the underscore the
# ligature sequences are built from. Anything above this range in the cmap is
# an icon alias, not a ligature component.
LIGATURE_COMPONENT_MAX_CODEPOINT = 0x2000


def log(message: str) -> None:
    print(f"[fonts] {message}", flush=True)


def fetch(url: str, cache_name: str) -> bytes:
    """Downloads `url` once into .font-cache/ and returns the bytes."""
    CACHE.mkdir(parents=True, exist_ok=True)
    cached = CACHE / cache_name
    if cached.exists() and cached.stat().st_size > 0:
        return cached.read_bytes()
    log(f"fetch {url[:96]}")
    request = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(request, timeout=120) as response:
        data = response.read()
    cached.write_bytes(data)
    return data


def google_css(query: str) -> str:
    return fetch(f"{CSS_API}?{query}&display=swap", "css-" + hashlib.sha1(query.encode()).hexdigest() + ".css").decode()


def font_face_blocks(css: str) -> list[tuple[str, dict[str, str]]]:
    """Splits a Google Fonts stylesheet into ([/* subset name */], declarations)."""
    blocks: list[tuple[str, dict[str, str]]] = []
    for match in re.finditer(r"/\*\s*([^*]+?)\s*\*/\s*@font-face\s*\{(.*?)\}", css, re.S):
        declarations: dict[str, str] = {}
        for line in match.group(2).splitlines():
            if ":" not in line:
                continue
            key, _, value = line.partition(":")
            declarations[key.strip()] = value.strip().rstrip(";")
        blocks.append((match.group(1).strip(), declarations))
    return blocks


def source_files() -> list[Path]:
    files: list[Path] = []
    for pattern in ("*.ts", "*.tsx"):
        files.extend(sorted(SRC.rglob(pattern)))
    return files


def string_literals() -> set[str]:
    """Every quoted identifier-ish literal in src/, e.g. `live_tv`."""
    pattern = re.compile(r"""['"]([A-Za-z][A-Za-z0-9_]*)['"]""")
    literals: set[str] = set()
    for path in source_files():
        literals.update(pattern.findall(path.read_text(encoding="utf-8")))
    return literals


def subset_text_family(spec: dict[str, str]) -> list[dict[str, object]]:
    css = google_css(spec["query"])
    faces: list[dict[str, object]] = []
    for subset, declarations in font_face_blocks(css):
        if subset != "latin":
            continue
        url = re.search(r"url\(([^)]+)\)", declarations["src"]).group(1)
        target = FONTS / f"{spec['slug']}-latin.woff2"
        target.write_bytes(fetch(url, f"{spec['slug']}-latin.woff2"))
        faces.append(
            {
                "family": spec["family"],
                "file": target.name,
                "fontWeight": declarations.get("font-weight", "400"),
                "fontStyle": declarations.get("font-style", "normal"),
                "unicodeRange": declarations.get("unicode-range", ""),
                # Text has no ligature contract: swapping late is invisible and
                # keeps body copy readable during the first paint.
                "fontDisplay": "swap",
            }
        )
    if not faces:
        raise SystemExit(f"google css for {spec['family']} had no latin face")
    return faces


def subset_icon_family() -> tuple[dict[str, object], list[str]]:
    css = google_css(ICON_QUERY)
    blocks = font_face_blocks(css)
    if not blocks:
        raise SystemExit("google css for the icon font had no @font-face")
    url = re.search(r"url\(([^)]+)\)", blocks[0][1]["src"]).group(1)
    upstream = CACHE / "material-symbols-rounded-upstream.woff2"
    upstream.write_bytes(fetch(url, upstream.name))

    # Decompress once: fontTools' subsetter and instancer want real sfnt data.
    source = CACHE / "material-symbols-rounded-upstream.ttf"
    font = TTFont(upstream)
    font.flavor = None
    font.save(source)
    font = TTFont(source)

    glyph_names = set(font.getGlyphOrder())
    every_name = {name for name in glyph_names if re.fullmatch(r"[a-z][a-z0-9_]*", name)}

    used = sorted((string_literals() & every_name) - {name for name in every_name if len(name) == 1})
    used = sorted(set(used) | set(ALWAYS_INCLUDE))
    unknown = [name for name in STATIC_GLYPHS if name not in glyph_names]
    if unknown:
        raise SystemExit(f"static glyphs missing from the upstream font: {unknown}")

    # `rlig` closure is *set* based in fontTools, so feeding the subsetter the
    # letter glyphs makes it pull in every icon name those letters can spell
    # (5.4 MB -> 3.9 MB, i.e. no subset at all). Instead: name the exact glyph
    # set and switch closure off, then the ligature lookups that survive are
    # only the ones whose inputs are all still present.
    cmap = font.getBestCmap()
    components = {cmap[code] for code in cmap if code < LIGATURE_COMPONENT_MAX_CODEPOINT}
    requested = sorted(set(used) | components)

    glyph_list = CACHE / "icon-glyphs.txt"
    glyph_list.write_text("\n".join(requested) + "\n", encoding="utf-8")

    target = FONTS / f"{ICON_SLUG}.woff2"
    subprocess.run(
        [
            sys.executable,
            "-m",
            "fontTools.subset",
            str(source),
            f"--output-file={target}",
            "--flavor=woff2",
            f"--glyphs-file={glyph_list}",
            "--no-layout-closure",
            "--layout-features=rlig",
            "--glyph-names",
            "--no-hinting",
            f"--name-IDs=*",
        ],
        check=True,
    )

    subset = TTFont(target)
    subset_glyphs = set(subset.getGlyphOrder())
    missing = [name for name in used if name not in subset_glyphs]
    if missing:
        raise SystemExit(f"subset dropped used icons: {missing}")

    # The ligature only fires if every typed character still maps to a glyph.
    subset_cmap = subset.getBestCmap()
    typed = {char for name in used for char in name}
    unmapped = sorted(char for char in typed if ord(char) not in subset_cmap)
    if unmapped:
        raise SystemExit(f"subset lost ligature component characters: {unmapped}")

    axes = [(axis.axisTag, axis.minValue, axis.maxValue) for axis in subset["fvar"].axes]
    dropped = [tag for tag, _, _ in axes if tag not in KEPT_AXES]
    if dropped:
        # Not fatal: the CSS only drives FILL/wght, but say so loudly if
        # upstream adds an axis that would silently flatten.
        log(f"warning: subset still carries unused axes {dropped}")

    face = {
        "family": ICON_FAMILY,
        "file": target.name,
        "fontWeight": "100 700",
        "fontStyle": "normal",
        "unicodeRange": "",
        # `block`, never `swap`: the markup holds ligature *names* (`live_tv`),
        # so a swap paints words on the television. `block` reserves the glyph
        # box and paints nothing until the (local, preloaded) file is ready.
        "fontDisplay": "block",
        "upstream": url,
        "upstreamBytes": upstream.stat().st_size,
        "bytes": target.stat().st_size,
        "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
        "glyphs": len(subset_glyphs),
        "axes": [{"tag": tag, "min": low, "max": high} for tag, low, high in axes],
    }
    return face, used


def glyph_outline(font: TTFont, name: str, fill: int) -> str:
    """SVG path for `name` with the font's y-up space flipped to SVG's y-down."""
    glyph_set = font.getGlyphSet(
        location={"FILL": fill, "GRAD": 0, "opsz": 24, "wght": 400}
    )
    pen = SVGPathPen(glyph_set)
    # `0 -960 960 960` style viewBox: glyph coordinates are y-up around a
    # baseline at 0, so mirror y and let the viewBox cover the em square.
    glyph_set[name].draw(TransformPen(pen, (1, 0, 0, -1, 0, 0)))
    # The flip turns integer font units into `-520.0`; rounding keeps the
    # generated module small and diff-stable.
    return re.sub(
        r"-?\d+\.\d+",
        lambda match: str(round(float(match.group(0)))),
        pen.getCommands(),
    )


def write_generated_module(source: Path, icons: list[str]) -> None:
    font = TTFont(source)
    upem = font["head"].unitsPerEm
    view_box = f"0 -{upem} {upem} {upem}"
    entries: dict[str, dict[str, str]] = {}
    for name in STATIC_GLYPHS:
        entries[name] = {
            "viewBox": view_box,
            "path": glyph_outline(font, name, 0),
            "filledPath": glyph_outline(font, name, 1),
        }

    lines = [
        "/*",
        " * GENERATED by scripts/build-fonts.py — do not edit by hand.",
        " *",
        " * Inline outlines for the marks that must never wait on a webfont",
        " * (see ADR 036). Coordinates are the font's, y flipped for SVG, inside",
        f" * an em-square viewBox of `{view_box}`.",
        " */",
        "",
        "export interface StaticGlyph {",
        "  viewBox: string;",
        "  path: string;",
        "  filledPath: string;",
        "}",
        "",
        "export const STATIC_GLYPHS: Record<string, StaticGlyph> = {",
    ]
    for name, glyph in entries.items():
        lines.append(f"  {name}: {{")
        lines.append(f"    viewBox: '{glyph['viewBox']}',")
        lines.append(f"    path: '{glyph['path']}',")
        lines.append(f"    filledPath: '{glyph['filledPath']}',")
        lines.append("  },")
    lines.append("};")
    lines.append("")
    lines.append("/**")
    lines.append(" * Icon names present in the subsetted webfont. `Icon` falls back to `help`")
    lines.append(" * for anything else, because an unknown name would otherwise render as the")
    lines.append(" * literal words it is spelled with — the bug this file exists to prevent.")
    lines.append(" */")
    lines.append("export const ICON_FONT_GLYPHS: readonly string[] = [")
    for name in icons:
        lines.append(f"  '{name}',")
    lines.append("];")
    lines.append("")
    GLYPH_PATHS_TS.write_text("\n".join(lines), encoding="utf-8")


def write_css(faces: list[dict[str, object]]) -> None:
    lines = [
        "/*",
        " * GENERATED by scripts/build-fonts.py — do not edit by hand.",
        " *",
        " * Self-hosted faces (ADR 036). Nothing here may point at a CDN: the",
        " * icon font is a ligature font, so a network round trip is the",
        " * difference between an icon and the literal word `arrow_forward`.",
        " */",
    ]
    for face in faces:
        lines.append("")
        lines.append("@font-face {")
        lines.append(f"  font-family: '{face['family']}';")
        lines.append(f"  font-style: {face['fontStyle']};")
        lines.append(f"  font-weight: {face['fontWeight']};")
        lines.append(f"  font-display: {face['fontDisplay']};")
        lines.append(f"  src: url('/fonts/{face['file']}') format('woff2');")
        if face.get("unicodeRange"):
            lines.append(f"  unicode-range: {face['unicodeRange']};")
        lines.append("}")
    lines.append("")
    FONTS_CSS.write_text("\n".join(lines), encoding="utf-8")


def write_manifest(icon_face: dict[str, object], icons: list[str], faces: list[dict[str, object]]) -> None:
    manifest = {
        "generatedBy": "scripts/build-fonts.py",
        "iconFont": {**icon_face, "icons": icons},
        "textFaces": [
            {key: value for key, value in face.items() if key in ("family", "file", "fontDisplay")}
            for face in faces
            if face["family"] != ICON_FAMILY
        ],
        "staticGlyphs": list(STATIC_GLYPHS),
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def main() -> None:
    for module in ("fontTools", "brotli"):
        try:
            __import__(module)
        except ImportError:
            raise SystemExit(f"missing python package `{module}` (pip install fonttools brotli)")

    FONTS.mkdir(parents=True, exist_ok=True)

    icon_face, icons = subset_icon_family()
    text_faces: list[dict[str, object]] = []
    for spec in TEXT_FAMILIES:
        text_faces.extend(subset_text_family(spec))

    write_generated_module(CACHE / "material-symbols-rounded-upstream.ttf", icons)
    write_css([icon_face, *text_faces])
    write_manifest(icon_face, icons, [icon_face, *text_faces])

    shutil.rmtree(ROOT / "public" / "fonts" / "__pycache__", ignore_errors=True)

    log(f"icons: {len(icons)} glyphs ({icon_face['glyphs']} in subset, {icon_face['bytes']} B)")
    for face in text_faces:
        log(f"{face['family']}: public/fonts/{face['file']} ({(FONTS / str(face['file'])).stat().st_size} B)")
    log(f"wrote {FONTS_CSS.relative_to(ROOT)}, {GLYPH_PATHS_TS.relative_to(ROOT)}, {MANIFEST.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
