# AGENTS.md — Aether IPTV Engineer & Agent Guidelines

## 1. Project Overview
Aether IPTV is a production-grade, 100% client-side IPTV web player designed for 10-foot TV interfaces (Android TV, Google TV, Fire TV, Chromecast with Google TV, desktop monitors, and tablets). It adheres strictly to Material Design 3 (M3) with a dark theme by default, full remote (D-pad) navigation, and zero server-side requirements.

## 2. General Guidelines

- When making technical decisions, do not give much weight to development cost.
Instead, prefer quality, simplicity, robustness, scalability, and long term maintainability.
- When doing bug fixes, always start with reproducing the bug in an E2E setting as closely aligned with how an end user would experience it.
This makes sure you find the real problem so your fix will actually solve it.
- When end-to-end testing a product, be picky about the UI you see and be obsessed with pixel perfection.
If something clearly looks off, even if it is not directly related to what you are doing, try to get it fixed along the way.
- Apply that same high standard to engineering excellence: lint, test failures, and test flakiness.
If you see one, even if it is not caused by what you are working on right now, still get it fixed.

## 3. Standard Development Commands
- `npm run dev`: Starts the Vite development server on port 3000.
- `npm run build`: Compiles production assets into `dist/`.
- `npm run lint`: Runs TypeScript typechecks (`tsc --noEmit`).
- `npm run check`: typecheck + eslint + coverage + Playwright e2e.
- Android (see §5): `android:sync`, `android:debug`, `android:release`, `android:assets`.

## 4. Architecture & Strict Layer Rules
The repository uses a strictly layered, feature-sliced architecture:

```
src/
  app/         # bootstrap, providers, router, theme context
  domain/      # pure types, Zod schemas, pure utility functions (NO React, NO I/O)
  services/    # I/O adapters behind interfaces (storage, player, playlist, epg, network)
  features/    # domain-specific features (onboarding, live-tv, guide, vod, player, etc.)
  shared/      # reusable primitives (ui, focus, input, icons, hooks, utils)
docs/          # architectural records, decisions, input guides
```

### Dependency Flow
`app -> features -> services / shared -> domain`
- **Rule 1:** Domain code must never import React or perform I/O.
- **Rule 2:** Features can only import from other features through their top-level `index.ts` public API barrel. Never import feature internals across boundaries.
- **Rule 3:** Never import `@noriginmedia/norigin-spatial-navigation` directly in features or app components. Always use the wrappers in `src/shared/focus`.
- **Rule 4:** Never use `localStorage` for bulk data (channels, EPG, playlists). Dexie (IndexedDB) is used for all persistent data.
- **Rule 5:** Never hardcode colors or magic rems; use M3 CSS variables (`var(--md-sys-color-*)`).
- **Rule 6:** TV remote is the 1st-class citizen. Every interactive control must be focusable via D-pad and triggerable with Select/OK.
- **Rule 7:** Never return raw booleans from `onArrowPress` handlers. Use the branded `ALLOW_DEFAULT_NAVIGATION` / `BLOCK_NAVIGATION` sentinels from `src/shared/focus` (the library's boolean polarity is inverted and caused BUG-001). `npm run check` fails on boolean returns.
- **Rule 8:** Never register raw `keydown`/`keyup`/`keypress` listeners on `window`, `document`, `document.body`, `globalThis`, or `self`, and never add JSX `onKeyDown`/`onKeyUp`/`onKeyPress` outside `src/shared/input/**` and the two allow-listed files `src/shared/input/useTvInput.ts` and `src/shared/ui/TextField.tsx`. Route keyboard input through `src/shared/input`. Enforced by `eslint-rules/no-raw-key-listeners` (BUG-002).
- **Rule 9:** UI bug fixes require a component (Vitest + Testing Library) or e2e (Playwright) regression test. Geometry-dependent D-pad behaviour must be covered by a Playwright spec; jsdom is only for non-geometric behaviour. See `docs/GUARDRAILS.md`.
- **Rule 10:** Any change to the Dexie schema requires a new `.version(n)` with an `.upgrade()` function and a migration test. Never mutate an existing version's stores in place, or reopen-preservation tests in `src/services/storage/db.test.ts` must be extended.
- **Rule 11:** Scrolling is focus-driven and owned by `src/shared/scroll`. Never call `scrollIntoView`, `scrollTo`/`scrollTop`, or use `scroll-behavior: smooth` (Tailwind `scroll-smooth`) outside that module. Derive offsets from the focused item's `data-scroll-*` index via the shared scroller hooks. See `docs/SCROLLING.md`. Enforced by `aether/no-adhoc-scroll`.

## 5. Android / Capacitor Shell
The web app is the product; `android/` is a thin Capacitor 7 shell that builds **two APKs from one `dist/`** via Gradle product flavors: `mobile` (`tv.aether.iptv`, touch/portrait) and `tv` (`tv.aether.iptv.tv`, leanback/landscape/D-pad only). Full build, install, signing and verification guide: `docs/ANDROID.md`.

```
npm run android:sync     # build dist + cap sync android (after web changes)
npm run android:debug    # assemble mobile + tv debug APKs
npm run android:release  # same, signed (needs android/keystore.properties)
npm run android:assets   # regenerate icons / TV banner / splash (needs Python 3 + Pillow)
bash scripts/android-gradle.sh installTvDebug   # adb install onto a connected TV
```
Outputs land in `android/app/build/outputs/apk/{mobile,tv}/{debug,release}/aether-iptv-*.apk`.

- **Rule 12:** Run Gradle only through `scripts/android-gradle.sh`, never bare `./gradlew`. Capacitor 7 / AGP 8.7 compile against **JDK 21**; the wrapper resolves a JDK 21+ and refreshes `android/local.properties`. Override with `AETHER_JAVA_HOME`.
- **Rule 13:** Keep the native shell thin. No product logic in `MainActivity.java`; native input/lifecycle must funnel into `src/shared/input` (BACK arrives as `@capacitor/app` `backButton` → `src/shared/input/nativeBackBridge.ts`). Never add a native capability the web layer could own.
- **Rule 14:** Form-factor differences live in Gradle `productFlavors` + `manifestPlaceholders` (`leanbackRequired`, `touchscreenRequired`, `screenOrientation`, `aether_touch_device`), never in JS user-agent sniffing. The `tv` flavor must stay leanback-required, landscape, touchscreen-not-required; `mobile` the inverse.
- **Rule 15:** Android change is done when the APK is verified, not when it compiles. Check badging (`aapt2 dump badging` → TV shows `leanback-launchable-activity` and `uses-feature-not-required: android.hardware.touchscreen`; mobile shows neither) plus an `adb shell input keyevent` D-pad smoke. Touch-mode focus / IME behaviour is locked by `MainActivityImeTest` — run `bash scripts/android-gradle.sh connectedMobileDebugAndroidTest connectedTvDebugAndroidTest`.

## 6. Definition of Done for Milestones
1. Typecheck passes cleanly (`npm run lint`).
2. Build completes successfully (`npm run build`).
3. D-pad navigation works cleanly across all new UI elements without focus traps.
4. Clean accessibility (visible focus ring, high contrast, readable at 3 meters).
5. `npm run check` passes (eslint + coverage + Playwright e2e); no new flakiness.
6. Shell/manifest/Gradle changes verified on a device or TV emulator (see Rule 15).
7. Document key architectural decisions in `docs/DECISIONS.md`.

## 7. Secrets and Local Files
- **Never commit credentials.** `.env` and every `.env.*` variant are ignored. `.env.example` is the only committed env file and must hold placeholders only (`YOUR_KEY_HERE`, `example.invalid`).
- **IPTV data is secret.** Xtream URLs embed credentials in the URL itself (`get.php?username=…&password=…`), so `*.m3u`, `*.m3u8`, `*.xmltv`, `*.epg.xml*`, `playlists/`, `xtream/`, `local/`, `private/` and app backup/settings exports are ignored by `.gitignore` and must never be committed.
- **Sanitized fixtures are the only exception,** in `src/test/fixtures/` (explicitly un-ignored at the bottom of `.gitignore`). They must contain no real hosts, usernames, passwords or tokens — use `example.invalid` and `demo:demo`.
- **Never commit keys or cloud credentials:** `*.pem`, `*.key`, `*.p12`, `*.pfx`, `*.jks`, `*.keystore`, `id_rsa*`, `id_ed25519*`, `*credentials*.json`, `service-account*.json`, `.npmrc`, `.netrc`, `.aws/`, `.gcloud/`, `.firebase/`, `.vercel/`, `.netlify/`, and the Android signing config `android/keystore.properties`.
- **Android secrets stay local:** `android/keystore.properties`, `android/local.properties`, `aether-release.jks` / `*.jks` and `android/app/build/` are ignored. `android/app/build.gradle` silently skips the release signing config when `keystore.properties` is missing, so clean checkouts still build debug. Back the release keystore up off-machine — losing it means losing the app identity.
- **Generated output stays out:** `dist/`, `coverage/`, `playwright-report/`, `test-results/`, `android/app/build/`, `*.tsbuildinfo`, `.eslintcache`.
- **`.gitignore` does not untrack anything.** If a secret reaches a commit, rotate the credential first, then `git rm --cached` it and scrub history — see `docs/DECISIONS.md` (ADR 016).
- Scan before pushing a release branch: `gitleaks git . --log-opts="--all"`.
