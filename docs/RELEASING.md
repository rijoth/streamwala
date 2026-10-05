# Releasing Streamwala

A git tag is the only way to publish. Pushing `v1.2.3` starts
`.github/workflows/release.yml`, which checks the commit the same way a pull
request is checked, builds the web bundle and both Android form factors, and
publishes a GitHub Release with every artifact attached.

## 1. Cut a release

```bash
scripts/release.sh patch --push        # v0.1.0 -> v0.1.1
scripts/release.sh minor --push
scripts/release.sh v1.0.0-rc.1 --push  # explicit tag, published as a pre-release
```

`scripts/release.sh` (also `npm run release -- patch --push`) refuses to run
unless you are on `main`, the tree is clean, `HEAD` equals `origin/main`, and the
tag does not exist yet. It creates an **annotated** tag whose message carries the
same `Signed-off-by:` trailer every commit needs (see `CONTRIBUTING.md`), then
pushes it. Without `--push` it only creates the tag and tells you the command.

The tag is the version. Nothing in the repository records it:

| Tag | Android `versionName` | Android `versionCode` |
| --- | --- | --- |
| `v0.1.0` | `0.1.0` | `1000` |
| `v1.2.3` | `1.2.3` | `1002003` |
| `v1.2.3-rc.1` | `1.2.3-rc.1` | `1002003` |

`versionCode` is packed as `major*1000000 + minor*1000 + patch`, so it only ever
grows and stays inside Android's `2100000000` ceiling (`major <= 2099`). A
pre-release suffix does not change it: an `-rc` and its final release share the
code, and you should not publish both to the same store track.

Locally, `android/app/build.gradle` falls back to `versionCode 1` /
`versionName "1.0"` when the Gradle properties are absent, so debug builds need
no setup.

## 2. What the pipeline does

```
tag push
  -> version   validate the tag, derive versionName/versionCode, write release notes
  -> verify    npm run check (tsc, eslint guardrails, vitest coverage, Playwright e2e)
  -> web       npm run build, zip dist/ as streamwala-web-vX.Y.Z.zip
  -> android   npm ci, JDK 21, Android SDK 35, restore keystore, cap sync,
               assembleMobileRelease assembleTvRelease
               bundleMobileRelease bundleTvRelease
               then verify: apksigner (not the debug key) + aapt2 manifest checks
  -> release   gh release create --verify-tag with all assets + SHA256SUMS.txt
```

`web` and `android` run in parallel; both wait for `verify`. A tag cannot
publish code that would fail a pull request.

Assets attached to the release:

```
streamwala-web-vX.Y.Z.zip      static bundle, unzip and serve over HTTPS
streamwala-mobile-vX.Y.Z.apk   tv.streamwala.iptv     (phone / tablet)
streamwala-tv-vX.Y.Z.apk       tv.streamwala.iptv.tv  (Android TV / Google TV / Fire TV)
streamwala-mobile-vX.Y.Z.aab   Google Play, mobile flavour
streamwala-tv-vX.Y.Z.aab       Google Play, TV flavour
SHA256SUMS.txt                 checksums for everything above
```

The `android` job enforces AGENTS.md Rule 15 before publishing: it runs
`apksigner verify --print-certs` (and fails if the APK is signed with
`CN=Android Debug`), `aapt2 dump badging` to assert that the TV APK is
leanback-launchable, requires `android.software.leanback` and marks the
touchscreen as not required, that the mobile APK does neither, and that both
APKs carry the tag's `versionCode` / `versionName`.

**Not covered in CI:** the instrumented `MainActivityImeTest` suite needs an
emulator and a connected device, so it stays a local check
(`bash scripts/android-gradle.sh connectedMobileDebugAndroidTest connectedTvDebugAndroidTest`).
D-pad geometry is covered by `e2e/dpad.spec.ts` in the `verify` job.

## 3. Required repository secrets

The `android` job fails fast (before Gradle) if any of these is missing or
empty. Set them once with `gh secret set`; the keystore itself is
`android/aether-release.jks` (gitignored, backed up off-machine).

| Secret | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 android/aether-release.jks` |
| `ANDROID_KEYSTORE_PASSWORD` | `storePassword` from `android/keystore.properties` |
| `ANDROID_KEY_ALIAS` | `keyAlias` (currently `aether`) |
| `ANDROID_KEY_PASSWORD` | `keyPassword` from `android/keystore.properties` |

```bash
base64 -w0 android/aether-release.jks | gh secret set ANDROID_KEYSTORE_BASE64
gh secret set ANDROID_KEYSTORE_PASSWORD
gh secret set ANDROID_KEY_ALIAS
gh secret set ANDROID_KEY_PASSWORD
```

The job decodes the keystore into `android/aether-release.jks`, writes
`android/keystore.properties`, and asserts that both paths are still matched by
`.gitignore` before Gradle configures. Secrets are never echoed. See
`docs/DECISIONS.md` (ADR 016, ADR 024).

Publishing uses the workflow's own `GITHUB_TOKEN` (`contents: write` on the
`release` job only); no personal access token is needed.

## 4. Re-running, editing, undoing

**Re-run a failed build.** `gh run rerun <run-id>` replays the whole workflow.
The `release` job is idempotent: if the release already exists it edits the
title/notes and re-uploads assets with `--clobber`.

**Re-release an existing tag.** Actions → Release → *Run workflow*, pass the tag
(`v1.2.3`). Use this after fixing a build-only problem, e.g. a rotated keystore
secret.

**Fix the notes.** Edit the release on GitHub directly. A re-run overwrites them
with the generated notes.

**Delete a bad release.** The tag is the version, so removing the release is not
enough:

```bash
gh release delete v1.2.3 --yes
git push --delete origin v1.2.3
git tag -d v1.2.3
```

Then fix and tag again. If the tag already reached a store, do **not** reuse its
`versionCode`: bump the patch and publish a new one.

**Keystore lost.** The pipeline cannot produce an update under the same
identity. Every existing install would have to be uninstalled first. This is why
the keystore is backed up off-machine (see `docs/ANDROID.md` §4); if it is truly
gone, accept a new app identity rather than shipping a debug-signed build.

## 5. Pre-releases

A tag with a suffix (`v1.2.3-rc.1`) is published as a GitHub pre-release, so it
never becomes "Latest". The workflow runs exactly the same, which is the point:
the artifact you test in an `-rc` is the artifact you get in the final release if
the code does not change.
