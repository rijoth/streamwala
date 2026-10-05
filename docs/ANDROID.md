# Android build guide (mobile + TV)

The web app is the product. Capacitor only adds a thin native shell, and the
Android project builds **two artifacts from the same `dist/` bundle** through
Gradle product flavors:

| Artifact | Application id | Form factor target |
| --- | --- | --- |
| `streamwala-mobile-*.apk` | `tv.streamwala.iptv` | Phones / tablets (touch, portrait allowed) |
| `streamwala-tv-*.apk` | `tv.streamwala.iptv.tv` | Android TV, Google TV, Fire TV (leanback, landscape, D-pad only) |

Different application ids mean a box can have both APKs installed side by side.

## 1. Prerequisites

- JDK **21** (Capacitor 7 / AGP 8.7 compile against `JavaVersion.VERSION_21`;
  a JDK 17 fails with `invalid source release: 21`).
- Android SDK with `platforms;android-35`, `build-tools;35.0.0`, `platform-tools`:
  ```bash
  export ANDROID_HOME=$HOME/Android/Sdk
  $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager \
      "platform-tools" "platforms;android-35" "build-tools;35.0.0"
  ```
- `android/local.properties` containing `sdk.dir=/abs/path/to/Android/Sdk`
  (gitignored; written automatically by `scripts/android-gradle.sh`).
- Python 3 + Pillow, only if you regenerate artwork.

### JDK selection

Run Gradle through **`scripts/android-gradle.sh`**, never bare `./gradlew` when
`JAVA_HOME` may be stale. The wrapper resolves a JDK 21+ in this order:

1. `$STREAMWALA_JAVA_HOME`
2. `$JAVA_HOME` (only if it exists and reports ≥ 21)
3. `~/.java/jdk`
4. `~/Android/android-studio/jbr`
5. `~/Android/jdk`, `/usr/lib/jvm/java-21-openjdk`, `/usr/lib/jvm/jdk-21`
6. whatever `java` is on `PATH`

It also resolves `ANDROID_HOME` (`$ANDROID_HOME` → `$ANDROID_SDK_ROOT` →
`~/Android/Sdk` → `~/Android/sdk`) and refreshes `android/local.properties`.

```bash
bash scripts/android-gradle.sh assembleTvRelease   # one-off gradle task
bash scripts/android-gradle.sh --version           # what JDK/SDK it picked
STREAMWALA_JAVA_HOME=/opt/jdk-21 npm run android:release
```

If a bare `./gradlew` aborts with `ERROR: JAVA_HOME is set to an invalid
directory: <path>`, the shell profile points at a deleted JDK — the wrapper
above ignores it, or fix it with `export JAVA_HOME=$HOME/.java/jdk`.

> Note on this machine: `~/.bash_profile` intentionally does **not** source
> `~/.bashrc`, so `JAVA_HOME` is pinned in both files.

## 2. Build

```bash
npm run android:debug     # build web bundle, cap sync, assemble 2 debug APKs
npm run android:release   # same, signed release APKs (needs keystore.properties)
npm run android:bundle    # same, signed release AABs for Google Play
npm run android:sync      # rebuild dist + cap sync only (after web changes)
npm run android:assets    # regenerate icons / banner / splash from brand colors
```

Outputs:

```
android/app/build/outputs/apk/mobile/debug/streamwala-mobile-debug.apk
android/app/build/outputs/apk/tv/debug/streamwala-tv-debug.apk
android/app/build/outputs/apk/mobile/release/streamwala-mobile-release.apk
android/app/build/outputs/apk/tv/release/streamwala-tv-release.apk
android/app/build/outputs/bundle/mobileRelease/app-mobile-release.aab
android/app/build/outputs/bundle/tvRelease/app-tv-release.aab
```

`versionName` / `versionCode` come from `android/app/build.gradle` defaults
(`1.0` / `1`) unless the release pipeline stamps them from the git tag:

```bash
bash scripts/android-gradle.sh \
  -Pstreamwala.versionName=1.2.3 -Pstreamwala.versionCode=1002003 \
  assembleTvRelease
```

Raw Gradle equivalents:

```bash
bash scripts/android-gradle.sh assembleMobileDebug assembleTvDebug
bash scripts/android-gradle.sh installTvDebug   # adb install onto a connected TV
```

## 3. Install on a device / TV box

```bash
adb connect <tv-ip>:5555          # Android TV: enable network debugging
adb install -r android/app/build/outputs/apk/tv/debug/streamwala-tv-debug.apk
adb shell input keyevent 19       # DPAD_UP smoke test
adb shell input keyevent 4        # BACK
```

On Fire TV use `adb install` over the same network debugging port, or sideload
with the Downloader app.

## 4. Release signing

`android/keystore.properties` (gitignored) drives `signingConfigs.release`:

```properties
storeFile=aether-release.jks
storePassword=…
keyAlias=aether
keyPassword=…
```

> The keystore filename and alias intentionally keep the pre-rename `aether`
> string: they are the app's signing identity and cannot change without a new
> keystore. See `DECISIONS.md` (ADR 019).

`android/app/build.gradle` skips the release signing config when the file is
absent, so debug builds keep working on a clean checkout. **Back the keystore up
off-machine**: losing it means you can never update the app under the same
identity. The release pipeline keeps this hazard away from published artifacts
by failing the job before Gradle whenever a keystore secret is missing, and by
rejecting a release APK that `apksigner` reports as debug-signed. See
`docs/RELEASING.md`.

## 5. What the shell does (and does not do)

`android/app/src/main/java/tv/streamwala/iptv/MainActivity.java`:

- immersive fullscreen with transient system bars on focus regain
- `FLAG_KEEP_SCREEN_ON` while the app is foregrounded
- `mediaPlaybackRequiresUserGesture = false` so hls.js / mpegts.js can autoplay
- focusable WebView so D-pad key events reach the DOM; the `mobile` flavor
  additionally enables touch-mode focus (`streamwala_touch_device` boolean
  resource) so tapping a text input raises the soft keyboard, and the activity
  declares `android:windowSoftInputMode="adjustResize"` (BUG-018). The `tv`
  flavor keeps touch-mode focus off so D-pad focus stays deterministic.
- translates the remote's OK button (`KEYCODE_DPAD_CENTER`, 23) into
  `KEYCODE_ENTER` (66). The spatial-navigation engine activates the focused item
  on an `Enter` DOM key event, so remotes that report OK only as DPAD_CENTER
  would otherwise select nothing.

BACK is **not** intercepted natively. Android delivers it to the Activity, so
`@capacitor/app`'s `backButton` event is forwarded to the existing
`dispatchBack()` funnel (`src/shared/input/nativeBackBridge.ts`). One physical
press pops exactly one overlay layer (ADR 008 / BUG-002); with an empty stack
the app exits.

Per-flavor manifest differences live in `manifestPlaceholders`
(`leanbackRequired`, `touchscreenRequired`, `screenOrientation`) plus the
`android/app/src/tv/AndroidManifest.xml` overlay, which adds the
`LEANBACK_LAUNCHER` category, the TV theme and forced landscape.

## 6. Verification

```bash
# Manifest correctness
ANDROID_HOME/build-tools/35.0.0/aapt2 dump badging \
  android/app/build/outputs/apk/tv/release/streamwala-tv-release.apk | grep -E "package|launchable|leanback|uses-feature"

# Signature
ANDROID_HOME/build-tools/35.0.0/apksigner verify --print-certs <apk>

# Web layer (unchanged by the shell)
npm run check
```

Expected in the TV badging output:

```
launchable-activity: name='tv.streamwala.iptv.MainActivity' …
leanback-launchable-activity: name='tv.streamwala.iptv.MainActivity' …
  uses-feature-not-required: name='android.hardware.touchscreen'
  uses-feature: name='android.software.leanback'
```

The mobile APK must show neither a leanback launcher nor
`uses-feature: name='android.software.leanback'`, and must require the
touchscreen instead. `.github/workflows/release.yml` asserts all of these with
`aapt2`, plus the tag's `versionCode`/`versionName`, before it publishes.

D-pad geometry is still covered by `e2e/dpad.spec.ts` for the web surface. jsdom
cannot prove device focus behaviour, so device-level checks are instrumented
(`android/app/src/androidTest`) or manual — see `docs/GUARDRAILS.md`.

### Soft keyboard (IME) regression — BUG-018

The mobile build must raise the OS keyboard when a text input is tapped. That is
native WebView focus, so it is locked by an instrumented test rather than jsdom:

```bash
bash scripts/android-gradle.sh connectedMobileDebugAndroidTest
bash scripts/android-gradle.sh connectedTvDebugAndroidTest
```

`MainActivityImeTest` launches the activity and asserts the WebView's
touch-mode focus matches the flavor's `streamwala_touch_device` value, and that the
window uses `SOFT_INPUT_ADJUST_RESIZE`. On a device you can also confirm by hand:
tap the Search field on the `mobile` APK and watch the IME appear.

### Verified on an Android TV emulator (API 36, `android-tv` x86_64, 1080p)

Both release APKs were installed and driven with `adb shell input keyevent`:

| Check | Command | Result |
| --- | --- | --- |
| TV APK installs on leanback image | `adb install -r streamwala-tv-release.apk` | ok |
| Boots immersive, no system bars | `adb shell am start -n tv.streamwala.iptv.tv/tv.streamwala.iptv.MainActivity` | welcome screen, focus ring visible |
| D-pad moves focus | `input keyevent 22` (RIGHT) | focus moved Get Started → Settings |
| OK activates | `input keyevent 23` (DPAD_CENTER) | onboarding advanced |
| D-pad traversal + import | `22`, `20`, `23` | demo playlist imported, Home screen rendered from IndexedDB |
| BACK exits when nothing owns it | `input keyevent 4` | app exited to TV launcher |
| Mobile APK boots independently | `adb install -r streamwala-mobile-release.apk` | ok (separate package/data) |

## 7. Known ceilings / follow-ups

- **WebView codec coverage.** hls.js and mpegts.js need Media Source Extensions
  plus device H.264/AAC decoders. Cheap boxes with old WebView builds can fail.
  The supported fix is a Media3/ExoPlayer `PlayerEngine` implementation behind
  the existing interface in `src/services/player`, keeping web engines as
  fallback.
- **Remote media keys.** Some boxes consume PLAY/FF/REW/CH+/CH- at the system
  level before the WebView sees them; forwarding them requires a new native
  input source routed through `src/shared/input`.
- **Play Store.** TV listing requires the 320×180 banner (generated) plus TV
  screenshots; the TV flavor is already leanback-required so it will only be
  offered to TV devices.
