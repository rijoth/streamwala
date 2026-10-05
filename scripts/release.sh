#!/usr/bin/env bash
#
# Tag a release. Pushing the tag is what publishes it:
#
#   scripts/release.sh patch          # v0.1.0 -> v0.1.1, tag created, not pushed
#   scripts/release.sh patch --push   # ... and pushed, so the pipeline runs
#   scripts/release.sh v1.0.0-rc.1 --push
#
# The tag is annotated and carries a Signed-off-by line, like every commit.
# See docs/RELEASING.md.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

usage() {
  cat <<'USAGE'
usage: scripts/release.sh (major|minor|patch|vX.Y.Z[-suffix]) [--push]

  major|minor|patch  bump the latest v* tag
  vX.Y.Z             an explicit tag (a leading 'v' is optional)
  --push             push the tag, which triggers .github/workflows/release.yml
USAGE
}

die() {
  printf 'release: %s\n' "$1" >&2
  exit 1
}

PUSH=0
ARGS=()
for arg in "$@"; do
  case "$arg" in
    --push) PUSH=1 ;;
    -h | --help)
      usage
      exit 0
      ;;
    -*)
      usage >&2
      die "unknown flag '$arg'"
      ;;
    *)
      ARGS+=("$arg")
      ;;
  esac
done

if [ "${#ARGS[@]}" -ne 1 ]; then
  usage >&2
  exit 2
fi
requested="${ARGS[0]}"

branch="$(git rev-parse --abbrev-ref HEAD)"
[ "$branch" = "main" ] || die "releases are tagged on main, but the current branch is '$branch'"
[ -z "$(git status --porcelain)" ] || die "working tree is not clean; commit or stash first"

git fetch --quiet --tags origin
git fetch --quiet origin main

if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
  die "HEAD is not origin/main; push or pull first"
fi

latest="$(git tag --list 'v[0-9]*' --sort=-v:refname | head -n1 || true)"
latest="${latest:-v0.0.0}"

if [[ "$requested" =~ ^v?[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$ ]]; then
  tag="v${requested#v}"
elif [[ "$requested" =~ ^(major|minor|patch)$ ]]; then
  base="${latest#v}"
  base="${base%%-*}"
  IFS=. read -r major minor patch <<<"$base"
  case "$requested" in
    major)
      major=$((major + 1))
      minor=0
      patch=0
      ;;
    minor)
      minor=$((minor + 1))
      patch=0
      ;;
    patch)
      patch=$((patch + 1))
      ;;
  esac
  tag="v$major.$minor.$patch"
else
  usage >&2
  die "expected 'major', 'minor', 'patch' or a tag like v1.2.3, got '$requested'"
fi

if git rev-parse -q --verify "refs/tags/$tag" > /dev/null; then
  die "tag $tag already exists"
fi

name="$(git config user.name || true)"
email="$(git config user.email || true)"
if [ -z "$name" ] || [ -z "$email" ]; then
  die "set git user.name and user.email first; the tag needs a real sign-off"
fi

git tag -a "$tag" -m "Streamwala ${tag#v}

Signed-off-by: $name <$email>"

printf 'release: created %s at %s (previous %s)\n' "$tag" "$(git rev-parse --short HEAD)" "$latest"

if [ "$PUSH" -eq 1 ]; then
  git push origin "$tag"
  printf 'release: pushed %s; .github/workflows/release.yml is building it.\n' "$tag"
  printf 'release: watch with  gh run list --workflow=release.yml\n'
else
  printf 'release: publish it with  git push origin %s\n' "$tag"
  printf 'release: undo it with     git tag -d %s\n' "$tag"
fi
