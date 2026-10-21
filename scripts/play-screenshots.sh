#!/usr/bin/env bash
#
# Capture real in-app screenshots for the Google Play listing.
#
#   scripts/play-screenshots.sh mobile        # -> images/phoneScreenshots/
#   scripts/play-screenshots.sh tv --serial 192.168.1.40:5555
#
# Play rejects device frames, mockups and anything that is not the running app,
# so the only honest way to produce these is to drive a build and grab the
# framebuffer. This script does the mechanical half: it captures over adb,
# enforces Play's dimension rules, and flattens each capture to 24-bit PNG
# (Play does not accept alpha in screenshots) so a rejected upload cannot be a
# format surprise.
#
# You still have to arrange each screen: dismiss dialogs, clear the notification
# shade, and start from the demo playlist so no real provider URL, username or
# channel name from a private account ends up in the store listing.
#
# Play minimums: two phone screenshots, one TV screenshot. Recommended for
# promotional placement: four 16:9 landscape (1920x1080) or 9:16 portrait
# (1080x1920) captures per device type.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

IMAGES_DIR="android/fastlane/metadata/android/en-US/images"

usage() {
  cat <<'USAGE'
usage: scripts/play-screenshots.sh (mobile|tv) [options]

  --serial <id>    adb serial of the device (default: the only attached device)
  --count <n>      number of captures (default: mobile 4, tv 4)
  --prefix <name>  file prefix (default: screen)

Each capture prompts you to arrange the next screen, then reads the device
framebuffer. The app must already be installed and showing the screen you want.
USAGE
}

die() {
  printf 'play-screenshots: %s\n' "$1" >&2
  exit 1
}

FLAVOR=""
SERIAL=""
COUNT=""
PREFIX="screen"

while [[ $# -gt 0 ]]; do
  case "$1" in
    mobile | tv)
      [[ -z "$FLAVOR" ]] || die "only one flavor per run"
      FLAVOR="$1"
      shift
      ;;
    --serial) SERIAL="${2:?--serial needs a value}"; shift 2 ;;
    --count) COUNT="${2:?--count needs a value}"; shift 2 ;;
    --prefix) PREFIX="${2:?--prefix needs a value}"; shift 2 ;;
    -h | --help) usage; exit 0 ;;
    *) usage >&2; die "unknown argument '$1'" ;;
  esac
done

[[ -n "$FLAVOR" ]] || { usage >&2; die "pass a flavor: mobile or tv"; }
COUNT="${COUNT:-4}"
[[ "$COUNT" =~ ^[0-9]+$ && "$COUNT" -ge 1 ]] || die "--count must be a positive integer"

if [[ "$FLAVOR" == "tv" ]]; then
  TARGET_DIR="$IMAGES_DIR/tvScreenshots"
else
  TARGET_DIR="$IMAGES_DIR/phoneScreenshots"
fi

command -v adb >/dev/null 2>&1 || die "adb is not on PATH (install platform-tools)"
command -v python3 >/dev/null 2>&1 || die "python3 is required to validate and flatten captures"
python3 -c 'import PIL' 2>/dev/null || die "Pillow is required (pip install Pillow)"

if [[ -z "$SERIAL" ]]; then
  mapfile -t devices < <(adb devices | awk 'NR > 1 && $2 == "device" { print $1 }')
  case "${#devices[@]}" in
    0) die "no adb device attached (check: adb devices)" ;;
    1) SERIAL="${devices[0]}" ;;
    *) die "multiple devices attached; pass --serial (${devices[*]})" ;;
  esac
fi

mkdir -p "$TARGET_DIR"
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/streamwala-shots.XXXXXX")"
trap 'rm -rf "$TMP_DIR"' EXIT

printf 'play-screenshots: %s -> %s (%d captures)\n' "$SERIAL" "$TARGET_DIR" "$COUNT"
for ((i = 1; i <= COUNT; i++)); do
  printf '\n[%d/%d] Arrange the screen on the device, then press Enter (Ctrl-C to stop).\n' "$i" "$COUNT"
  read -r _

  raw="$TMP_DIR/raw-$i.png"
  # exec-out keeps the PNG bytes intact; a plain `adb shell` would rewrite CR/LF.
  adb -s "$SERIAL" exec-out screencap -p > "$raw"
  [[ -s "$raw" ]] || die "empty capture from $SERIAL (unlock the device and try again)"

  output="$(printf '%s/%02d-%s.png' "$TARGET_DIR" "$i" "$PREFIX")"
  python3 - "$raw" "$output" "$FLAVOR" <<'PY'
import sys

from PIL import Image

raw, output, flavor = sys.argv[1], sys.argv[2], sys.argv[3]
with Image.open(raw) as image:
    width, height = image.size
    if width < 320 or height < 320:
        raise SystemExit(f"capture is {width}x{height}; Play needs at least 320px per side")
    if max(width, height) > 3840:
        raise SystemExit(f"capture is {width}x{height}; Play's maximum dimension is 3840px")
    if max(width, height) > 2 * min(width, height):
        raise SystemExit(
            f"capture is {width}x{height}; Play requires the long side to be at most twice the short side"
        )
    if flavor == "tv":
        if height > width:
            raise SystemExit("TV capture is portrait; Android TV screenshots are 16:9 landscape")
        if height < 720 or width < 1280:
            raise SystemExit(f"capture is {width}x{height}; TV screenshots need at least 1280x720")
        if width < 1920 or height < 1080:
            print(f"  note: {width}x{height} is below 1920x1080, the size Play recommends for TV", file=sys.stderr)
    # Play rejects alpha in screenshots; flatten to 24-bit RGB.
    image.convert("RGB").save(output, format="PNG")
    print(f"  saved {output} ({width}x{height})")
PY

  rm -f "$raw"
done

shots="$(find "$TARGET_DIR" -name '*.png' | wc -l | tr -d ' ')"
printf '\nplay-screenshots: %s now holds %s screenshot(s)\n' "$TARGET_DIR" "$shots"
if [[ "$FLAVOR" == "tv" && "$shots" -lt 1 ]]; then
  die "a TV listing needs at least one TV screenshot"
fi
if [[ "$FLAVOR" == "mobile" && "$shots" -lt 2 ]]; then
  die "a listing needs at least two screenshots"
fi
printf 'Next: scripts/play-upload.sh %s --metadata-only --dry-run\n' "$FLAVOR"
