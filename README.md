# Streamwala

Streamwala is a client-side IPTV player for big screens and Android TV. It is a React and TypeScript web app with a remote-first interface and a dark Material Design 3 theme. There is no backend. Playlists, channels, the guide and your favourites all live in the browser.

I built it because most IPTV players are desktop apps that ignore a remote, or thin wrappers around someone else's service. I wanted something I could point at my own M3U or Xtream account, drive entirely with a TV remote, and run without a server in the middle.

## What works

Live TV with channel groups and zapping. Playback tries hls.js, then mpegts.js, then the native video element, so HLS, MPEG-TS and plain MP4 sources all get a chance. Changing channels shows a Now and Next banner, a number pad accepts direct channel entry, and an info button toggles playback stats.

The EPG is a timeline guide you move around with the D-pad on two axes, with programme details and a Now indicator. You can attach more than one XMLTV feed per playlist, and channels that do not match automatically are listed in a match report so you can map them by hand.

Favorites and a global search over channel name, number and category. A settings screen covers theme (dark, AMOLED, light), playback engine, TV safe area, UI scale, playlist management and network options.

Everything is reachable with a remote: arrows, OK, BACK, the media keys and the colour buttons. Scrolling follows focus rather than the other way around, and BACK closes one layer per press. Android BACK flows through the same path in the Capacitor shell.

## Running it

You need Node. I develop on Node 24, which is what CI uses.

```
npm install
npm run dev
```

That serves on port 3000. The rest:

```
npm run build          # production bundle in dist/
npm run lint           # tsc --noEmit
npm run lint:eslint    # ESLint, including the custom guardrail rules
npm run test           # Vitest
npm run test:coverage  # Vitest with coverage thresholds
npm run e2e            # Playwright Chromium (run npx playwright install chromium first)
npm run check          # all of the above, in that order
```

`npm run check` is what CI runs on every push.

## Adding a source and a guide

First launch shows an onboarding screen. You pick one of four sources:

- Demo: a short built-in list of public test streams and open movie clips, useful for checking that playback works.
- M3U / M3U8 URL: paste a playlist link. You can drop an XMLTV URL into the same form.
- Local file: choose a .m3u or .m3u8 from disk.
- Xtream Codes: server URL, username and password.

Later, Settings, then Manage Playlists, then Edit EPG lets you attach, refresh and re-map guide data. Everything is stored in IndexedDB for this browser and origin, so clearing site data wipes it. Settings themselves are small and live in localStorage.

## Rough edges

Many IPTV providers do not send CORS headers, so the browser refuses their requests. Settings has a few public proxy presets and a custom template field where you can point at your own proxy, something like `https://your-proxy/?url={url}`. I do not run a proxy and cannot promise the public ones stay up.

Host the app over HTTPS and plain `http://` stream or EPG URLs are blocked as mixed content. You need HTTPS sources, a proxy, or a local file.

There is no recording and no VOD or series browser yet. The guide is a guide, not a DVR.

XMLTV files get big. A 50 MB file is parsed off the main thread in a worker and only programmes inside your retention window are kept, but the first import still takes time, and the download speed is up to the host.

## How the code is laid out

```
src/
  app/        bootstrap, settings store, EPG runtime
  domain/     types, Zod schemas, pure helpers (no React, no I/O)
  services/   storage (Dexie), playlist and EPG parsers, player engines
  features/   onboarding, live-tv, guide, favorites, search, settings, player
  shared/     ui, focus, input, scroll, icons
e2e/          Playwright D-pad specs
docs/         architecture, EPG, TV input, scrolling, Android and decisions
android/      Capacitor shell for the mobile and TV APKs
```

`docs/ARCHITECTURE.md` describes the layers and the one-way dependency rule. `docs/DECISIONS.md` explains why things are the way they are, including the bugs that forced some of it. Input handling is in `docs/TV_INPUT.md`, the EPG pipeline in `docs/EPG.md`, and focus-driven scrolling in `docs/SCROLLING.md`.

## Android TV

The web app is the product; Capacitor only adds a shell. Two Gradle flavours build from one `dist/` bundle: `mobile` for touch devices, `tv` for Android TV (landscape, remote only). They use different application ids, so both can be installed side by side.

You need JDK 21 and the Android SDK with platform 35. Run Gradle through `scripts/android-gradle.sh`, never bare `./gradlew`; the wrapper picks a JDK 21 and refreshes `android/local.properties`.

```
npm run android:sync     # build the web bundle and cap sync
npm run android:debug    # assemble both debug APKs
npm run android:release  # signed release APKs (needs android/keystore.properties)
npm run android:assets   # regenerate icons, banner and splash
```

APKs land in `android/app/build/outputs/apk/{mobile,tv}/{debug,release}/`. `docs/ANDROID.md` covers signing, installing and the manifest checks.

## Only a player

Streamwala ships no channels and no playlists. You are responsible for the sources you add and for having the right to watch them. The built-in demo list is public test streams and open movie clips only.

## Contributing

Issues and pull requests are welcome. `AGENTS.md` lists the rules the codebase is held to, and `npm run check` has to pass before a change lands. If you fix a UI bug, please add a regression test with it.

The code is licensed under the GNU General Public License, version 3 only. The full text is in `LICENSE`. The Streamwala name and logo are not covered by that license; see `NOTICE`.
