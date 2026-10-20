# Search Feature (`src/features/search`)

## Purpose
Shared inline search building blocks. Search is not a destination: Home, Live TV
and Favorites each own a compact `SearchField` and a scope (all channels, the
active Live TV chip, or the pinned favorites). `SearchResultsGrid` renders the
Home result grid, and `useSearchFocusGuard` keeps focus and the scroll offset
consistent when the filtered list changes under the focus ring.
