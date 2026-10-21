#!/usr/bin/env bash
#
# Upload one Streamwala build to Google Play through fastlane supply.
#
#   scripts/play-upload.sh mobile                     # AAB + listing -> internal
#   scripts/play-upload.sh tv --track beta
#   scripts/play-upload.sh mobile --metadata-only     # listing only, no AAB
#   scripts/play-upload.sh tv --dry-run               # show what would run
#
# The store copy lives once, in android/fastlane/metadata/android/en-US, and this
# script stages the flavor-specific subset (phone screenshots for `mobile`, the
# TV banner and TV screenshots for `tv`) into a temporary metadata tree before
# invoking supply. That is what keeps two Play listings from drifting: the text
# and the icon have exactly one source, and only the device-specific images are
# selected per package.
#
# Credentials (all gitignored): a Play Developer API service account key, either
#   export PLAY_SERVICE_ACCOUNT_JSON=/abs/path/to/service-account.json
# or pass --json-key. docs/PLAY_STORE.md covers creating it and granting access.
#
# See docs/PLAY_STORE.md for the console-side checklist (app content, data
# safety, content rating, TV form factor) that no script can fill in for you.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

METADATA_DIR="android/fastlane/metadata/android/en-US"
IMAGES_DIR="$METADATA_DIR/images"
CHANGELOGS_DIR="$METADATA_DIR/changelogs"
KEYSTORE_PROPS="android/keystore.properties"

usage() {
  cat <<'USAGE'
usage: scripts/play-upload.sh (mobile|tv) [options]

  --track <track>        internal (default), alpha, beta or production
  --release-status <s>   completed (default), draft or inProgress;
                         production defaults to draft so a human starts the rollout
  --notes <text>         "What's new" for this version (max 500 characters)
  --notes-file <path>    read the notes from a file instead
  --metadata-only        upload the store listing only, no AAB
  --bundle <path>        AAB to upload (default: the flavor's release AAB)
  --version-code <n>     override the versionCode derived from the latest tag
  --version-name <s>     override the versionName derived from the latest tag
  --json-key <path>      service account JSON (default: $PLAY_SERVICE_ACCOUNT_JSON)
  --dry-run              print the staged tree and the supply command, then stop
USAGE
}

die() {
  printf 'play-upload: %s\n' "$1" >&2
  exit 1
}

note() {
  printf 'play-upload: %s\n' "$1"
}

FLAVOR=""
TRACK="internal"
NOTES=""
NOTES_FILE=""
METADATA_ONLY=0
BUNDLE=""
VERSION_CODE=""
VERSION_NAME=""
RELEASE_STATUS=""
JSON_KEY="${PLAY_SERVICE_ACCOUNT_JSON:-}"
DRY_RUN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    mobile | tv)
      [[ -z "$FLAVOR" ]] || die "only one flavor per run"
      FLAVOR="$1"
      shift
      ;;
    --track) TRACK="${2:?--track needs a value}"; shift 2 ;;
    --release-status) RELEASE_STATUS="${2:?--release-status needs a value}"; shift 2 ;;
    --notes) NOTES="${2:?--notes needs a value}"; shift 2 ;;
    --notes-file) NOTES_FILE="${2:?--notes-file needs a value}"; shift 2 ;;
    --bundle) BUNDLE="${2:?--bundle needs a value}"; shift 2 ;;
    --version-code) VERSION_CODE="${2:?--version-code needs a value}"; shift 2 ;;
    --version-name) VERSION_NAME="${2:?--version-name needs a value}"; shift 2 ;;
    --json-key) JSON_KEY="${2:?--json-key needs a value}"; shift 2 ;;
    --metadata-only) METADATA_ONLY=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h | --help) usage; exit 0 ;;
    *) usage >&2; die "unknown argument '$1'" ;;
  esac
done

[[ -n "$FLAVOR" ]] || { usage >&2; die "pass a flavor: mobile or tv"; }

case "$TRACK" in
  internal | alpha | beta | production) ;;
  *) die "unknown track '$TRACK' (internal|alpha|beta|production)" ;;
esac

# A production upload with release_status=completed goes to every user the
# moment the review passes. Default that one track to a draft so starting the
# rollout stays a deliberate click in Play Console.
if [[ -z "$RELEASE_STATUS" ]]; then
  if [[ "$TRACK" == "production" ]]; then
    RELEASE_STATUS="draft"
  else
    RELEASE_STATUS="completed"
  fi
fi
case "$RELEASE_STATUS" in
  completed | draft | inProgress | halted) ;;
  *) die "unknown release status '$RELEASE_STATUS' (completed|draft|inProgress|halted)" ;;
esac

# Two packages, two Play listings, one shared store copy.
if [[ "$FLAVOR" == "mobile" ]]; then
  PACKAGE="tv.streamwala.iptv"
else
  PACKAGE="tv.streamwala.iptv.tv"
fi

# The tag is the version, exactly as .github/workflows/release.yml reads it:
# versionCode = major*1000000 + minor*1000 + patch, monotonic and below
# Android's 2100000000 ceiling.
if [[ -z "$VERSION_CODE" || -z "$VERSION_NAME" ]]; then
  tag="$(git describe --tags --abbrev=0 --match 'v[0-9]*' 2>/dev/null || true)"
  [[ -n "$tag" ]] || die "no vX.Y.Z tag found; pass --version-code and --version-name"
  if [[ ! "$tag" =~ ^v([0-9]+)\.([0-9]+)\.([0-9]+)(-[0-9A-Za-z.]+)?$ ]]; then
    die "latest tag '$tag' is not a release tag (vX.Y.Z[-suffix])"
  fi
  major="${BASH_REMATCH[1]}"
  minor="${BASH_REMATCH[2]}"
  patch="${BASH_REMATCH[3]}"
  VERSION_NAME="${VERSION_NAME:-${tag#v}}"
  VERSION_CODE="${VERSION_CODE:-$((major * 1000000 + minor * 1000 + patch))}"
fi

[[ "$VERSION_CODE" =~ ^[0-9]+$ ]] || die "versionCode must be numeric"
[[ "$VERSION_CODE" -le 2100000000 ]] || die "versionCode is above Android's 2100000000 ceiling"

if [[ -z "$BUNDLE" ]]; then
  BUNDLE="android/app/build/outputs/bundle/${FLAVOR}Release/app-${FLAVOR}-release.aab"
fi

if [[ "$METADATA_ONLY" -eq 0 ]]; then
  [[ -f "$BUNDLE" ]] || die "no AAB at $BUNDLE (run: npm run android:bundle)"
  # Gradle silently skips signingConfig.release when keystore.properties is
  # missing, and Play rejects an unsigned AAB with a message that does not name
  # the cause. Fail here instead.
  [[ -f "$KEYSTORE_PROPS" ]] || die "missing $KEYSTORE_PROPS: cannot prove the AAB is signed"
fi

# "What's new": explicit notes, else a per-version file, else a safe placeholder.
if [[ -z "$NOTES" && -n "$NOTES_FILE" ]]; then
  [[ -f "$NOTES_FILE" ]] || die "no notes file at $NOTES_FILE"
  NOTES="$(cat "$NOTES_FILE")"
fi
if [[ -z "$NOTES" && -f "$CHANGELOGS_DIR/$VERSION_CODE.txt" ]]; then
  NOTES="$(cat "$CHANGELOGS_DIR/$VERSION_CODE.txt")"
fi
if [[ -z "$NOTES" ]]; then
  NOTES="Bug fixes and playback improvements."
  note "no notes given; using the placeholder release note"
fi
(( ${#NOTES} <= 500 )) || die "release notes are ${#NOTES} characters; Play allows 500"

if [[ "$DRY_RUN" -eq 0 ]]; then
  command -v fastlane >/dev/null 2>&1 \
    || die "fastlane is not installed (gem install fastlane, or use bundler)"
  [[ -n "$JSON_KEY" ]] || die "set PLAY_SERVICE_ACCOUNT_JSON or pass --json-key"
  [[ -f "$JSON_KEY" ]] || die "no service account key at $JSON_KEY"
fi

STAGE="$(mktemp -d "${TMPDIR:-/tmp}/streamwala-play.XXXXXX")"
trap 'rm -rf "$STAGE"' EXIT
LOCALE_DIR="$STAGE/en-US"
mkdir -p "$LOCALE_DIR/images" "$LOCALE_DIR/changelogs"

# Shared copy: one source for both listings.
cp "$METADATA_DIR/title.txt" \
   "$METADATA_DIR/short_description.txt" \
   "$METADATA_DIR/full_description.txt" \
   "$LOCALE_DIR/"
cp "$IMAGES_DIR/icon.png" "$IMAGES_DIR/featureGraphic.png" "$LOCALE_DIR/images/"

# One optional per-flavor override, so the two listings are not two apps with an
# identical name on the same store. Everything else stays shared on purpose.
if [[ -f "$METADATA_DIR/title.$FLAVOR.txt" ]]; then
  cp "$METADATA_DIR/title.$FLAVOR.txt" "$LOCALE_DIR/title.txt"
fi

printf '%s\n' "$NOTES" > "$LOCALE_DIR/changelogs/$VERSION_CODE.txt"

copy_shots() {
  local source_dir="$1"
  local label="$2"
  local count=0
  if compgen -G "$source_dir/*.png" >/dev/null; then
    mkdir -p "$LOCALE_DIR/images/$label"
    cp "$source_dir"/*.png "$LOCALE_DIR/images/$label/"
    count="$(find "$LOCALE_DIR/images/$label" -name '*.png' | wc -l | tr -d ' ')"
  fi
  printf '%s' "$count"
}

if [[ "$FLAVOR" == "tv" ]]; then
  cp "$IMAGES_DIR/tvBanner.png" "$LOCALE_DIR/images/"
  shots="$(copy_shots "$IMAGES_DIR/tvScreenshots" tvScreenshots)"
  if [[ "$shots" -lt 1 ]]; then
    note "warning: no TV screenshots staged; Play will not publish a TV listing without one"
  fi
else
  shots="$(copy_shots "$IMAGES_DIR/phoneScreenshots" phoneScreenshots)"
  if [[ "$shots" -lt 2 ]]; then
    note "warning: only $shots phone screenshot(s) staged; Play requires at least two"
  fi
fi

supply_args=(
  --package_name "$PACKAGE"
  --metadata_path "$STAGE"
  --track "$TRACK"
  --release_status "$RELEASE_STATUS"
)

if [[ "$METADATA_ONLY" -eq 1 ]]; then
  supply_args+=(--skip_upload_aab true)
else
  supply_args+=(--bundle "$BUNDLE")
fi

if [[ -n "$JSON_KEY" ]]; then
  supply_args+=(--json_key "$JSON_KEY")
fi

note "flavor    $FLAVOR -> $PACKAGE"
note "version   $VERSION_NAME ($VERSION_CODE) on track '$TRACK' ($RELEASE_STATUS)"
note "bundle    $([[ "$METADATA_ONLY" -eq 1 ]] && echo '(listing only)' || echo "$BUNDLE")"
note "staging   $STAGE"
find "$STAGE" -type f | sed "s|$STAGE/|  |" | sort

if [[ "$DRY_RUN" -eq 1 ]]; then
  note "dry run; would execute:"
  printf '  fastlane supply'
  printf ' %q' "${supply_args[@]}"
  printf '\n'
  exit 0
fi

fastlane supply "${supply_args[@]}"
note "done: $PACKAGE $VERSION_NAME ($VERSION_CODE) submitted to '$TRACK'"
