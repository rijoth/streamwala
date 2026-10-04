# EPG Pipeline (`docs/EPG.md`)

Streamwala ingests XMLTV entirely client-side. This document describes the data
flow, the matching rules, the storage schema, the performance limits and how to
troubleshoot CORS/gzip. For the reasoning see [`DECISIONS.md`](./DECISIONS.md)
(ADR 018).

## Data flow

```
playlist (m3u/xtream/file)
  └─ EpgSource(s)  ── detect ──►  url-tvg header / xmltv.php / manual URL / local file
         │
         ▼
  services/epg/fetcher   stream + byte progress, gzip sniff, ETag/Last-Modified, CORS classification
         │
         ▼
  parser.worker (lazy chunk)   xmltvTokenizer (SAX-style) → parseXmltv
         │                     retention window, tvg-shift, missing-stop, overlap trim
         ▼
  services/epg/refresh   atomic persistence via EpgRepository
         │
         ├─ epgChannels, epgMappings, programs
         └─ source stats (counts, match rate, validators)
         │
         ▼
  app/epgRuntime   scheduler + Now/Next service + status
         ├─ useNowNext(channelId)   player banner, Live TV rows, Home "Live now"
         └─ EpgGuideView            virtualized timeline + program details
```

### Layers

- **Domain** (`src/domain/epg/`): pure. `time.ts` (XMLTV timestamps, tvg-shift,
  stop resolution), `matching.ts` (channel ↔ XMLTV matching), `nowNext.ts`
  (`getNowNext`, `programProgress`). No React, no I/O.
- **Services** (`src/services/epg/`): `fetcher`, `xmltvTokenizer`, `parseXmltv`,
  `parser.worker`, `workerClient` (hand-rolled postMessage RPC — no Comlink),
  `repository` (+ `fakeRepository`), `refresh`, `scheduler`, `nowNextService`,
  `detect`, `matchReport`.
- **App/features**: `app/epgRuntime.tsx` owns the runtime; the settings EPG
  panel and the Guide consume it.

## Matching rules (`domain/epg/matching.ts`)

Priority order; each tier only runs when the previous found nothing:

1. **Exact `tvg-id`** = XMLTV channel id (trimmed, case-insensitive).
2. **Normalized name** — `tvg-name`/channel name vs. XMLTV `display-name`.
   Normalization strips diacritics, quality tags (`HD`, `FHD`, `4K`, `(720p)`,
   `H265`, …), punctuation and optional country affixes, then lowercases and
   collapses whitespace.
3. **Fuzzy** — Sørensen–Dice bigram similarity above a conservative threshold
   (`0.86`) **and** a required lead over the runner-up (`0.08`).

A tie never auto-maps: it is reported as `ambiguous` in the match report and the
user resolves it with the manual-mapping sheet. Manual mappings (`method:
'manual'`) always override auto-matching and survive re-sync and refresh.
Matching requires XMLTV channels to precede programmes (XMLTV spec); programmes
for channels that cannot be matched are discarded while streaming.

## Storage schema (Dexie v2)

| Table | Key / indexes | Notes |
|---|---|---|
| `epgSources` | `id, playlistId, enabled, priority` | One per attached feed; merged by `priority`. |
| `epgChannels` | `id, sourceId, playlistId, xmltvId, [sourceId+xmltvId]` | `id = ${sourceId}::${xmltvId}` (stable across refresh). |
| `epgMappings` | `channelId, playlistId, sourceId, epgChannelId, manual` | One per channel; `manual` wins. |
| `programs` | `id, channelId, tvgId, start, stop, sourceId, [channelId+start]` | Stable id `prog_${channelId}_${start}`. |

Writes are batched inside short transactions; `applyProgrammeImport` swaps one
channel's programmes atomically (delete + insert), so a failed refresh never
wipes the existing guide. `pruneExpired(now)` deletes only `stop < now`, so the
airing programme is never removed. Deleting a playlist cascades all EPG tables;
deleting a source cascades its channels, mappings and programmes.

## Performance limits & budgets

- The parser runs in a **lazy-loaded worker chunk**; the main bundle only grows
  by the EPG services + Now/Next wiring. Measured lazy chunks: parser worker
  ~12.7 kB raw (~4 kB gz), Guide ~4.1 kB gz, settings EPG panel ~6.3 kB gz.
- A ~50 MB XMLTV (≈5 MB gz) is parsed streaming with a tolerant tokenizer (no
  `DOMParser`), so memory stays bounded by the kept programmes, not the file.
- The Guide is virtualized on both axes and queries programmes by channel +
  day window; opening from cached data is well under 1 s.
- Now/Next is cached per channel for 60 s and only re-queried on channel,
  refresh-version or minute-tick changes.

## Troubleshooting

- **CORS** — the EPG host blocks browser requests. Enable a CORS proxy in
  Settings → Network, or use **Import file** in the playlist EPG panel. The
  error dialog names the host only (credentials are never printed).
- **Mixed content** — a plain `http://` EPG URL on an HTTPS page. Use an HTTPS
  URL, a proxy, or a local file.
- **gzip** — gzip is detected by magic bytes (`1f 8b`); `Content-Encoding` and
  the `.gz` extension are only consulted when the first bytes are unavailable,
  so an already-decoded body is never decompressed twice. If the device lacks
  `DecompressionStream`, use an uncompressed XMLTV URL.
- **Stuck on "Downloading… 0 B"** — the download has an idle timeout (30 s,
  re-armed on every chunk) and the worker has a 90 s no-message watchdog, so a
  stalled host fails with a retryable message instead of hanging. A large but
  steady download is not killed.
- **No data / unmatched channels** — open Settings → Playlists → **Edit EPG**,
  check the match report and map channels manually.
- **Credentials** — Xtream XMLTV URLs embed `username`/`password`; the UI masks
  them and they never reach logs, error text or the worker cache.
