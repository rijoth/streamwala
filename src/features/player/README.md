# Player Feature (`src/features/player`)

## Purpose
Provides the 10-foot TV video playback experience with multi-engine switching (HLS.js, mpegts.js, and native HTML5), fast remote zapping, direct number entry, OSD overlays, and nerd stats.

## Components
- `PlayerView`: Main player screen supporting Up/Down channel zapping, direct digit entry, and error recovery.
- `PlayerControlsOverlay`: OSD for play/pause, aspect ratio, audio/subtitle tracks, PiP, and fullscreen.
- `NowNextBanner`: Auto-hiding info banner with current/next program schedule and progress indicator.
- `MiniChannelOverlay`: Slide-in drawer for browsing channels during playback without leaving the video.
- `NumberZapOverlay`: On-screen digits overlay committing channel changes within 2 seconds.
- `NerdStatsOverlay`: Technical diagnostics (bitrate, resolution, buffer length, dropped frames).
