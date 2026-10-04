# Guide Feature (`src/features/guide`)

## Purpose
10-foot EPG timeline (channels × time) with 2-D D-pad navigation, a pinned time
header and channel column, a "now" indicator, day switcher, jump-to-now and a
program-details side sheet with direct channel launch.

## Files
| File | Purpose |
|---|---|
| `EpgGuideView.tsx` | Screen: header/status, day chips, virtualized grid, details sheet, empty/loading states. |
| `GuideRow.tsx` | One channel row + focusable program/empty cells. |
| `ProgramDetailsSheet.tsx` | Program details side sheet (Watch now / favorite / optional reminder). |
| `useGuidePrograms.ts` | Batched per-window programme query behind the EPG runtime. |
| `guideLayout.ts` | Pure day-bounds + program layout math (tested). |
| `EpgMirror.tsx` | Mirrors a scroll axis onto a pinned element (header/column). |

## Notes
- Virtualized on both axes via `src/shared/scroll`; programme queries are scoped
  to the visible day, never the full EPG.
- BACK closes the details sheet first (the `SideSheet` owns the handler).
- Empty states: no guide attached (with an action), loading, and
  "No program information" cells — never a blank grid.
- Loaded lazily by `App.tsx` so the timeline stays out of the initial bundle.
