# Publishing Streamwala on Google Play

Two installable apps, two Play listings, one shared player:

| Play listing | Package (`applicationId`) | Gradle flavor | Format |
| --- | --- | --- | --- |
| Streamwala | `tv.streamwala.iptv` | `mobile` | **tablets only** (sw600dp+, i.e. 7" and up), touch, portrait allowed |
| Streamwala TV | `tv.streamwala.iptv.tv` | `tv` | Android TV / Google TV, leanback, landscape only |

Different package names mean Play treats them as separate apps: separate
listing, separate content rating, separate data safety form, separate review.
They share the store copy in `android/fastlane/metadata/android/en-US/` so the
two listings cannot drift apart; only the device-specific images differ.

**Neither listing is offered to phones or watches.** The enforcement is in the
manifest, not in the console (see §1, "Form-factor gates"): the `tv` bundle
requires `android.software.leanback`, and the `mobile` bundle supports only the
`large`/`xlarge` screen classes with a 600dp minimum width. Nothing has to be excluded by hand in the device catalog for
these two device classes to be gone, and the release workflow fails if either
declaration disappears.

`docs/ANDROID.md` covers building and verifying the artifacts themselves. This
page is the store-side checklist: what Play requires, where each answer lives in
this repository, and the exact commands that upload it.

## 1. What already satisfies Play's hard requirements

| Requirement | Where | Status |
| --- | --- | --- |
| Target API 35+ for new apps (34+ for Android TV) | `android/variables.gradle` (`targetSdkVersion = 35`) | ok |
| Min SDK 24+ (Play automatic protection) | `android/variables.gradle` (`minSdkVersion = 24`) | ok |
| Signed Android App Bundle (AAB), not APK | `npm run android:bundle` -> `android/app/build/outputs/bundle/{mobile,tv}Release/*.aab` | ok |
| Play App Signing | enrolled on the first AAB upload; `android/aether-release.jks` is the **upload** key | ok |
| App icon 512x512, 32-bit PNG, <= 1024 KB | `android/fastlane/metadata/android/en-US/images/icon.png` (generated) | ok |
| Feature graphic 1024x500, 24-bit PNG | `.../images/featureGraphic.png` (generated) | ok |
| >= 2 screenshots, 320-3840 px, long side <= 2x short side, no alpha | `.../images/tenInchScreenshots/` (tablet captures) | **capture before publishing** |
| TV banner 1280x720 | `.../images/tvBanner.png` (generated) | ok |
| >= 1 Android TV screenshot | `.../images/tvScreenshots/` | **capture before publishing** |
| TV: leanback launcher, touchscreen not required, landscape | `android/app/src/tv/AndroidManifest.xml` + `manifestPlaceholders` | ok |
| Tablet: `large`/`xlarge` screen classes only, 600dp minimum width, touchscreen required, no leanback | `android/app/src/main/AndroidManifest.xml` (`<supports-screens>`) | ok |
| Android TV home banner 320x180 | `android/app/src/main/res/drawable-nodpi/tv_banner.png` (generated) | ok |
| Privacy policy URL | `docs/PRIVACY.md` — must be publicly hosted (see §2) | **host before publishing** |
| Data safety, content rating, target audience | Play Console forms — answers in §4 | console |

`android/app/build.gradle` skips `signingConfigs.release` when
`android/keystore.properties` is absent, which produces an **unsigned** AAB and
an unhelpful Play rejection. `scripts/play-upload.sh` refuses to run without
that file for exactly this reason.

## 2. Store copy, graphics and the privacy policy

### Copy

One source, three files, with the character limits Play enforces (a Vitest
guard, `src/shared/ui/brand/playStoreAssets.test.ts`, fails the build if any of
them is exceeded):

| File | Limit | Current |
| --- | --- | --- |
| `title.txt` | 30 chars | `Streamwala IPTV Player` (tablet listing) |
| `title.tv.txt` | 30 chars | `Streamwala IPTV Player for TV` (TV listing override) |
| `short_description.txt` | 80 chars | 76 |
| `full_description.txt` | 4000 chars | 2286 |

Play's metadata policy also bans "best"/"#1"/"free"/"download now" language and
price or ranking claims; the current copy avoids all of it.

The only per-listing override is the title (`title.tv.txt`): two Play apps with
the identical name in the same store are allowed but confusing to install. Every
other string is shared, and `scripts/play-upload.sh` copies the override over the
staged `title.txt` for the `tv` flavor only.

### Graphics

```bash
npm run play:assets        # python3 scripts/play-assets.py (needs Pillow)
```

Regenerates `icon.png`, `featureGraphic.png` and `tvBanner.png` from the same
brand constants as the launcher icons and the web mark (ADR 021 / ADR 032). Play
masks the icon's corners itself, so `icon.png` is full-bleed on the brand plate
with no rounded corners baked in.

The feature graphic is currently the mark on the brand backdrop. Play *highly
recommends* a graphic that shows the app experience rather than repeating the
icon, so before a production launch replace it with a composed capture (real
screenshot, not a mockup) once the tablet screenshots exist.

### Screenshots

Play rejects device frames, mockups, marketing frames and anything that is not
the running app, so these can only come from a device:

```bash
npm run android:debug
bash scripts/android-gradle.sh installMobileDebug      # or installTvDebug
scripts/play-screenshots.sh mobile --count 4           # tablet emulator, 1920x1200
scripts/play-screenshots.sh tv --count 4 --serial 192.168.1.40:5555
```

The `mobile` listing is tablet-only, so its captures go to
`images/tenInchScreenshots/` and there are deliberately no phone screenshots to
stage. Capture on a 7" or 10" tablet AVD (1920x1200 or 2560x1600 landscape,
or 1200x1920 portrait) — a phone-sized capture would advertise a form factor
Play no longer serves.

The script captures over `adb exec-out screencap`, enforces Play's dimension
rules, and flattens each capture to 24-bit PNG (no alpha) into the right
`images/` folder.

Before capturing, start from the **demo playlist** and check every visible
channel name, logo and URL: an IPTV account's credentials are often visible in a
stream URL, and a screenshot is a public document. Clear the notification shade
and any dialogs (Play asks for full battery/Wi-Fi icons and no personal
notifications).

Recommended: 4 captures each — 16:9 landscape at 1920x1080 for TV, 1920x1200
landscape (or 1200x1920 portrait) on the tablet — showing onboarding, Live TV,
the Guide and the player.

### Privacy policy

Play requires a **publicly reachable URL** that is not a PDF, not a download and
not behind a login. `docs/PRIVACY.md` is the policy text; host it, then paste the
URL into Play Console -> *App content* -> *Privacy policy* for **both** listings.

Any static host works. With GitHub Pages, enable Pages on `main` with the
`/docs` folder as the source and use:

```
https://rijoth.github.io/streamwala/PRIVACY.html
```

(GitHub Pages serves Markdown as HTML; check the rendered URL before pasting it
into Play.) Two details the policy already covers and that must stay true:
the app has no developer backend and no telemetry, and `android:allowBackup`
lets Android include the app database in the user's own device backup.

## 3. One-time Play Console setup

1. **Developer account** — verified identity. Organisation accounts need a
   D-U-N-S number. A **new personal account** must run a closed test with **12
   testers opted in for 14 continuous days** before it can apply for production
   access, so plan the calendar around that, not around the build.
2. **Create app** (twice, once per package): default language `en-US`, app name
   `Streamwala` / `Streamwala TV`, type *App*, free. The package name must match
   the AAB exactly.
3. **App signing** — the first AAB upload enrolls the app in Play App Signing.
   Google holds the app signing key; `android/aether-release.jks` becomes the
   upload key. Consequences:
   - `apksigner verify` locally proves the *upload* key, not the key users see.
   - Losing `aether-release.jks` no longer means a new app identity: request an
     upload key reset in Play Console. Still back it up off-machine
     (`docs/ANDROID.md` §4, `docs/RELEASING.md` §4).
   - Never opt out of Play App Signing; you cannot re-enroll with the same key.
4. **Store listing** — paste the copy from the `*.txt` files, upload the
   generated graphics, then add the captures. For the `mobile` listing Play's
   *Phone* screenshot section stays empty on purpose: the bundle declares a
   600dp minimum width, so no phone can install it and phone captures would
   describe a device class the app does not serve. Fill the *10-inch tablet*
   section from `images/tenInchScreenshots/` instead.
5. **App access** — choose "All functionality is available without special
   access" and paste reviewer instructions:
   `Open the app, choose "Get Started", then "Demo Playlist". The demo uses
   public test streams; no account is needed.` Reviewers cannot use a real IPTV
   account, so the demo path is what they will judge.
6. **Ads** — "No ads".
7. **Content rating** — see §4.
8. **Target audience** — 18+ (or 13+ if you prefer; the app contains no
   user-generated content but plays content the user supplies). Do **not** opt
   into Designed for Families.
9. **Data safety** — see §4.
10. **TV form factor** (the `tv` listing only) — Play Console -> *Advanced
    settings* -> *Form factors* -> *Android TV*: upload the 1280x720 banner and
    the TV screenshots. Without this section the TV app is not offered to TV
    devices, even though the manifest is leanback-required.
11. **Category** — *Video Players & Editors*; tags: IPTV, M3U, EPG, HLS.
12. **Government / financial / health declarations** — all "No".

### Verifying the device restriction in the console

The manifest already does the filtering, but check it once per listing after the
first AAB upload: *Reach and devices* -> **Device catalog** -> *Supported
devices*. Expected results:

| Listing | Supported device groups |
| --- | --- |
| Streamwala (tablet) | tablet models with a 600dp+ smallest width; **no** phone, **no** Wear OS, **no** TV |
| Streamwala TV | Android TV / Google TV / Fire TV models; **no** phone, **no** tablet, **no** Wear OS |

If a phone or watch still appears as supported, the AAB is stale — check
`aapt2 dump badging` for `uses-feature: android.software.leanback` (TV) or
`requiresSmallestWidthDp=600` (tablet) before touching the device catalog. The
device catalog is the wrong place to fix a manifest mistake: an exclusion list
is per-app and hand-maintained, while the manifest filter is verified by CI.

Do not add Wear OS or phone form-factor sections to either listing. A form
factor section is an opt-in that advertises the app to that device class; an
empty one is the correct state here.

## 4. Callback: the declaration forms

No file can answer these, and a wrong answer is a policy violation rather than a
build error. Answer for **each** listing.

### Data safety

| Question | Answer | Why |
| --- | --- | --- |
| Does your app collect or share any required user data types? | **No** | Nothing is transmitted to the developer; there is no developer server, analytics, ads or crash reporting. |
| Is all user data encrypted in transit? | **No** | The app permits the plain-HTTP IPTV endpoints the user configures (see the manifest's network security config). Do not claim transport encryption the player does not guarantee. |
| Do you provide a way for users to request data deletion? | Not applicable (no account, nothing held) | Everything is deleted by removing the playlist, clearing app data or uninstalling. |
| Committed to the Play Families policy? | No | Target audience is 18+/13+. |

Requested permissions shown in the form: `INTERNET`, `ACCESS_NETWORK_STATE`,
`WAKE_LOCK` — all "app functionality". No data type is declared as collected
because none leaves the device to the developer. The user's own playlist
credentials travel to the server the *user* configured, as any browser request
would; that is the app functioning as a client, not the developer collecting.

**If a reviewer disputes it:** do not invent a collection. Point at
`docs/PRIVACY.md` (the app has no backend) and at the "App access" instructions
(demo playlist). If Play still insists, declare *Personal info -> User IDs* with
"collected: no; shared: no", purpose "App functionality", processed ephemerally —
which is the closest truthful mapping — and note in the review reply that the
credentials are entered by the user for their own provider.

### Content rating (IARC questionnaire)

Answer "No" to every content question: violence, sexuality, nudity, profanity,
controlled substances, gambling, horror, user-generated content, user
interaction, location sharing, digital purchases. The app ships no content and
no social features; it plays media the user supplies.

Do **not** answer "Yes" to "does the app contain ads" — there is no ad SDK.
Expected result: *Everyone / PEGI 3 / ESRB Everyone* with an "in-app purchases:
no" note. The questionnaire lets you add free text; use it to say that
"content is supplied by the user, and the app ships only public test streams."

### IPTV-specific policy risk

Google removes apps that facilitate unauthorised access to copyrighted content.
The listing stays on the right side of that line only if these remain true:

- The app ships no channels, playlists or guide data; the demo list is public
  test streams and open movie clips.
- The store copy says the user is responsible for the sources they add and must
  have the right to watch them (it does, in `full_description.txt`).
- Nothing in the listing, screenshots or feature graphic suggests free premium
  channels, pay-TV access or a bundled subscription.
- No third-party logos, channel brands or provider trademarks appear in the
  store graphics or screenshots.

## 5. Uploading

```bash
npm run android:bundle                              # builds + signs both AABs
scripts/play-upload.sh mobile --metadata-only        # listing first
scripts/play-upload.sh mobile --track internal --notes "First internal build"
scripts/play-upload.sh tv --track internal
```

`scripts/play-upload.sh`:

- derives `versionName` / `versionCode` from the latest `v*` tag with the same
  packing as `.github/workflows/release.yml`
  (`major*1000000 + minor*1000 + patch`), and refuses a non-release tag,
- stages the shared copy plus the flavor's images into a temporary metadata tree
  and writes `changelogs/<versionCode>.txt` from `--notes`, `--notes-file` or
  `android/fastlane/metadata/android/en-US/changelogs/<versionCode>.txt`,
- uploads through `fastlane supply` with a Play Developer API service account,
- refuses to upload an AAB without `android/keystore.properties`, and defaults
  the `production` track to `release_status=draft` so starting the rollout stays
  a human decision.

Prerequisites:

```bash
gem install fastlane            # or: bundle exec fastlane supply ...
export PLAY_SERVICE_ACCOUNT_JSON=/abs/path/service-account.json
```

Create the service account in Google Cloud Console (enable *Google Play Android
Developer API*, create a JSON key), then invite its address in Play Console ->
*Users and permissions* with *Release to testing tracks* and *Manage store
presence* for **both** apps. Store the key outside the repository — `.gitignore`
covers `service-account*.json`, `*credentials*.json` and
`android/play-service-account.json`.

Dry run first; it prints the staged tree and the exact `supply` command:

```bash
scripts/play-upload.sh tv --dry-run
```

### Tracks

| Track | Use |
| --- | --- |
| `internal` | up to 100 testers, instant review-free availability; smoke test a real AAB |
| `alpha` / `beta` | closed/open testing; the 14-day, 12-tester requirement for new personal accounts happens here |
| `production` | user-facing. Uploaded as a draft; press *Start rollout* in Play Console |

`versionCode` must increase for every upload to a track. It is derived from the
tag, so cut a release (`scripts/release.sh patch --push`) rather than hand-editing
it; never reuse a `versionCode` that reached a track, and remember an `-rc` tag
shares its `versionCode` with the final release.

## 6. Review-time checklist

Before pressing *Send for review*:

- [ ] `npm run check` passes on the tagged commit (CI already enforces this).
- [ ] Both AABs came from that tag and both listings carry its `versionCode`.
- [ ] Screenshots are from the current UI, contain no IPTV credentials and no
      provider names.
- [ ] Privacy policy URL loads in a private window with no login.
- [ ] Data safety and content rating match §4.
- [ ] The `tv` listing has the TV form factor section filled in (banner +
      screenshot), or TV devices will never see it.
- [ ] The `mobile` listing shows **no** phone screenshots and its tablet
      screenshots come from a 600dp+ device.
- [ ] Device catalog shows phones and Wear OS watches as unsupported on both
      listings (§3, "Verifying the device restriction").
- [ ] Reviewer instructions point at the demo playlist.
- [ ] For the TV app: BACK returns to the launcher, focus is visible on every
      screen, and no UI requires touch (`docs/ANDROID.md` §6).

## 7. When Play pushes back

| Rejection | Usual cause | Fix |
| --- | --- | --- |
| "App bundle was signed with the wrong key" | uploaded an AAB built without `keystore.properties` | restore the properties file, `npm run android:bundle`, re-upload with a higher `versionCode` |
| "Your APK or bundle uses a target SDK version that is too low" | stale `variables.gradle` | raise `targetSdkVersion`; rerun the device checks |
| "Broken functionality" | reviewer could not get past onboarding | improve the "App access" instructions so the demo path is the first thing they read |
| "Missing TV screenshot / banner" | TV form factor section incomplete | upload `tvBanner.png` and the TV captures |
| Listing offers the app to phones / watches | AAB built before the width gate, or a form-factor section was added by mistake | check badging (`supports-screens: 'large' 'xlarge'` + `requiresSmallestWidthDp=600` for tablet, `android.software.leanback` for TV), rebuild with `npm run android:bundle`, remove the form-factor section |
| "Facilitating unauthorised access" | listing language or screenshots implied free premium TV | remove the implication, restate the user-supplied-source position, keep the demo clean |
| "Prominent disclosure / permissions" | a new permission was added without justification | declare it in the data safety form and the listing; or drop it |

An appeal is a text form, not a rebuild: quote the relevant policy section, link
`docs/PRIVACY.md`, and describe the demo path. Do not resubmit the same binary
unchanged.
