#!/usr/bin/env bash
#
# Android build entry point.
#
# Capacitor 7 compiles against Java 21 (android/app/capacitor.build.gradle sets
# sourceCompatibility/targetCompatibility to VERSION_21), so the Gradle wrapper
# must run on a JDK 21+. Ambient environments are frequently stale (an old
# JAVA_HOME pointing at a deleted JDK makes `./gradlew` abort with
# "JAVA_HOME is set to an invalid directory"), therefore this script resolves a
# usable JDK itself and hands it to Gradle.
#
# Usage:
#   bash scripts/android-gradle.sh assembleMobileDebug assembleTvDebug
#   bash scripts/android-gradle.sh installTvRelease
#   AETHER_JAVA_HOME=/path/to/jdk-21 bash scripts/android-gradle.sh tasks
#
# Override the JDK explicitly with AETHER_JAVA_HOME (highest priority).

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_DIR="$ROOT_DIR/android"
MIN_JAVA_MAJOR=21

die() {
  printf 'android-gradle: %s\n' "$1" >&2
  exit 1
}

is_jdk() {
  [ -n "$1" ] && [ -x "$1/bin/java" ] && [ -x "$1/bin/javac" ]
}

java_major() {
  "$1/bin/java" -version 2>&1 | awk -F'"' '/version/ { print $2 }' |
    awk -F. '{ if ($1 == "1") print $2; else print $1 }'
}

resolve_jdk() {
  local candidate
  local candidates=(
    "${AETHER_JAVA_HOME:-}"
    "${JAVA_HOME:-}"
    "$HOME/.java/jdk"
    "$HOME/Android/android-studio/jbr"
    "$HOME/Android/jdk"
    "/usr/lib/jvm/java-21-openjdk"
    "/usr/lib/jvm/jdk-21"
  )

  # Fall back to whatever `java` is on PATH, if it is a real JDK.
  local path_java
  path_java="$(command -v java || true)"
  if [ -n "$path_java" ]; then
    candidates+=("$(cd "$(dirname "$path_java")/.." && pwd)")
  fi

  for candidate in "${candidates[@]}"; do
    if is_jdk "$candidate"; then
      local major
      major="$(java_major "$candidate" || true)"
      if [ -n "$major" ] && [ "$major" -ge "$MIN_JAVA_MAJOR" ]; then
        printf '%s' "$candidate"
        return 0
      fi
    fi
  done

  return 1
}

resolve_android_sdk() {
  local candidate
  for candidate in "${ANDROID_HOME:-}" "${ANDROID_SDK_ROOT:-}" "$HOME/Android/Sdk" "$HOME/Android/sdk"; do
    if [ -n "$candidate" ] && [ -d "$candidate/cmdline-tools" ]; then
      printf '%s' "$candidate"
      return 0
    fi
  done
  return 1
}

JAVA_HOME="$(resolve_jdk || true)"
if [ -z "$JAVA_HOME" ]; then
  die "no JDK ${MIN_JAVA_MAJOR}+ found. Set AETHER_JAVA_HOME=/path/to/jdk-21 (checked \$AETHER_JAVA_HOME, \$JAVA_HOME, ~/.java/jdk, ~/Android/android-studio/jbr, ~/Android/jdk, /usr/lib/jvm)."
fi
export JAVA_HOME

SDK_DIR="$(resolve_android_sdk || true)"
if [ -n "$SDK_DIR" ]; then
  export ANDROID_HOME="$SDK_DIR"
  export PATH="$SDK_DIR/platform-tools:$PATH"
  # local.properties is gitignored; keep it in sync so Android Studio agrees.
  printf 'sdk.dir=%s\n' "$SDK_DIR" > "$ANDROID_DIR/local.properties"
fi

printf 'android-gradle: JAVA_HOME=%s (java %s)\n' "$JAVA_HOME" "$(java_major "$JAVA_HOME")"
if [ -n "$SDK_DIR" ]; then
  printf 'android-gradle: ANDROID_HOME=%s\n' "$SDK_DIR"
fi

cd "$ANDROID_DIR"
exec ./gradlew "$@"
