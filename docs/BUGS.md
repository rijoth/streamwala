# Aether IPTV — Bug Log

Tracking file for the systematic bug-hunt pass. One row per confirmed defect.
Status legend: **Open** (reproduced, not fixed) · **Fixed** · **Deferred** (reason recorded) · **Suspected** (unproven).

Severity: **P0** crash/data loss/cannot onboard or play · **P1** major feature broken or D-pad dead-end · **P2** incorrect behavior with workaround · **P3** cosmetic/minor.

## Baseline (Phase 1) — pre-fix

| Check | Command | Result |
|---|---|---|
| Typecheck | `npx tsc --noEmit` (no `typecheck`/`lint`/`test`/`e2e`/`check` scripts exist) | PASS (exit 0) |
| Build | `npx vite build` | PASS — `dist/assets/index-*.js` 1,926.17 kB (gzip 532.72 kB); CSS 49.30 kB. Warning: chunk > 500 kB |
| Unit tests | n/a — no test runner or `test` script in `package.json` | Not available |
| E2E | n/a — no Playwright/`e2e` script | Not available |
| VCS | `git status` → "not a git repository" | Not available |

Note: `package.json` scripts are only `dev`, `build`, `preview`, `clean`, `lint` (= `tsc --noEmit`). `pnpm test`/`pnpm e2e`/`pnpm check` from the task brief do not exist. Dependencies are already installed; lockfiles present: `bun.lock`, `package-lock.json`.

## Confirmed bugs

| ID | Severity | Area | Symptom | Root cause | Fix commit | Test |
|---|---|---|---|---|---|---|
| BUG-001 | P1 | Input & focus | Cannot move focus out of the left Navigation Rail with D-pad Right; nav rail is a dead-end/trap. | `NavigationRail.tsx` `NavRailItem.onArrowPress` returns `false` for direction `right`. norigin core treats `=== false` as *prevent default navigation* (`onArrowPress(...) === false` → `preventDefaultNavigation`), so the intended "leave the rail" behaviour is inverted. | `fix(focus): allow D-pad to leave nav rail (BUG-001)` | Manual D-pad check (no DOM runner); norigin contract verified at `@noriginmedia/norigin-spatial-navigation-core/dist/index.cjs:845` |
| BUG-002 | P1 | Input & focus | One BACK/Backspace press can pop two layers at once (e.g. close the mini channel list **and** exit the player; or close a dialog **and** exit the player). | `backHandlerStack` dispatch lived inside every `useTvInput` window listener. App and PlayerView both register one, so a single key event ran the pop logic twice. Fixed by funnelling dispatch through one module-level listener + `dispatchBack()`. | `fix(input): single-dispatch BACK stack (BUG-002)` | `src/shared/input/useTvInput.test.ts` |
| BUG-003 | P1 | Search & focus | While typing in the Search text field, the first keystroke moves focus to the first result card; continued typing/backspace no longer reaches the input. | `SearchView` rendered result cards with `autoFocus={idx === 0}`. On each query change a new keyed card mounted and its `focusSelf()` stole focus from the DOM input. Removed result auto-focus so the field keeps focus; results are reachable with D-pad Down. | `fix(search): keep focus in search field (BUG-003)` | Manual D-pad/virtual-keyboard check (needs DOM runner) |
| BUG-004 | P2 | Storage | Deleting a playlist leaves orphaned `programs` and `history` rows; EPG tables grow without bound across playlist deletes. | `deletePlaylist()` deleted `playlists`, `channels`, `groups` but never `programs` (keyed by `channelId`) nor `history`. Fixed by collecting the playlist's channel ids and cascading both inside the same transaction. | `fix(storage): cascade playlist delete to EPG and history (BUG-004)` | Manual IndexedDB check (no fake-indexeddb dependency available) |
| BUG-005 | P2 | XMLTV parsing | Valid XMLTV timestamps with a compact timezone (`YYYYMMDDHHMMSS+0530`, no space) or a 2-digit offset (`+05`) parse to `NaN`; programmes with a missing `stop` get `stop = Date.now()` which can be before `start`. | `parseXmltvDate()` only read the offset when `dateStr.length >= 19` and assumed a space at index 14. Rewritten with a regex that accepts optional whitespace and an optional 2-digit minute part; `parseAndSaveXmltv` now defaults a missing/invalid `stop` to `start + 30 min`. | `fix(epg): robust XMLTV date parsing and missing stop (BUG-005)` | `src/services/epg/xmltvParser.test.ts` |
| BUG-006 | P2 | Playback lifecycle | Fatal HLS errors are reported to the manager (triggering engine fallback/retry) *and* recovery (`startLoad()`/`recoverMediaError()`) is invoked in the same handler; a recoverable media error can therefore cause an unnecessary engine switch, and a rapid channel change can let a stale async `init` update state for the wrong channel. | `HlsPlayerEngine` ERROR handler calls `listener.onError(msg, true)` before `startLoad()`/`recoverMediaError()`; `PlayerManager.attemptEngineAtIndex` has no generation/abort token. | _pending_ | _pending_ |
| BUG-007 | P3 | Input normalization | `PAUSE` via keyCode `19` is unreachable (Android `KEYCODE_DPAD_UP` is also 19 and the NAV_UP check runs first). Backspace (keyCode 8) is not mapped to `BACK` outside inputs although `docs/TV_INPUT.md` specifies it. | `normalizeKeyEvent` ordering/coverage in `keyCodes.ts`. | _pending_ | _pending_ |
| BUG-008 | P2 | EPG UI | EPG guide is fully un-virtualized: it fetches programs sequentially for up to 30 channels and renders every channel row; a large playlist (10k–100k channels) will lock the main thread. No "now" indicator element exists in the grid. | `EpgGuideView` maps `channels` directly with an `await` loop. | _pending_ | _pending_ |
| BUG-009 | P3 | Styling | Several utility classes used for focus/scale/borders are not valid Tailwind v4 tokens (`ring-3`, `scale-103`, `scale-104`, `scale-102`, `w-18`, `h-18`, `border-3`); they silently emit no CSS. Hardcoded palette colors (`amber-400`, `red-600`, `emerald-*`, `slate-900`) bypass M3 tokens (AGENTS Rule 5). | Various components. | _pending_ | _pending_ |

## Deferred / not implemented (out of scope: no feature work in this pass)

| ID | Severity | Area | Finding | Why deferred |
|---|---|---|---|---|
| BUG-010 | P1 (feature gap) | Parental controls | The parental-lock feature does not exist: `isLocked`, `parentalPin`, `parentalLockedGroups` are never read for enforcement; no PIN entry UI exists (`pinCode` state is dead); the PIN would be stored in plaintext `localStorage`. Task brief's "PIN cannot be bypassed" cannot be audited against a feature that was never built. | Implementing PIN hashing/lock gating is a new feature, not a bug fix. Flagged for a product decision. |
| BUG-011 | P2 (feature gap) | Onboarding | Import is not cancelable; `parseAndSaveM3U` writes channels/groups before `savePlaylist`, so a failure between them leaves orphan rows; parsing runs on the main thread (no worker). | Requires new cancellation/worker design; log as follow-up. |
| BUG-012 | P2 (feature gap) | PWA / offline | There is no service worker, manifest, or offline shell despite the brief's PWA section. | Not a regression; new feature. |

## Suspected (unproven — not fixed speculatively)

- Autoplay muted-start fallback in `HlsPlayerEngine`/`NativePlayerEngine` never surfaces an "unmute" prompt; the user can be left silently muted.
- `getChannelsByGroup` loads the whole playlist into memory and filters in JS (`groupId`/search); for 100k channels this is a full scan on every group change. There is a compound `[playlistId+groupId]` index that is unused.
- `testXtreamLogin` only treats `auth === 0` as failure; expired/disabled `status` values are not checked.
- `CorsDiagnosticModal` displays `failedUrl` verbatim; user-supplied M3U URLs with embedded credentials/tokens could be exposed on screen.
