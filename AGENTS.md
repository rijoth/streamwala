# AGENTS.md — Aether IPTV Engineer & Agent Guidelines

## 1. Project Overview
Aether IPTV is a production-grade, 100% client-side IPTV web player designed for 10-foot TV interfaces (Android TV, Google TV, Fire TV, Chromecast with Google TV, desktop monitors, and tablets). It adheres strictly to Material Design 3 (M3) with a dark theme by default, full remote (D-pad) navigation, and zero server-side requirements.

## 2. Standard Development Commands
- `npm run dev`: Starts the Vite development server on port 3000.
- `npm run build`: Compiles production assets into `dist/`.
- `npm run lint`: Runs TypeScript typechecks (`tsc --noEmit`).

## 3. Architecture & Strict Layer Rules
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

## 4. Definition of Done for Milestones
1. Typecheck passes cleanly (`npm run lint`).
2. Build completes successfully (`npm run build`).
3. D-pad navigation works cleanly across all new UI elements without focus traps.
4. Clean accessibility (visible focus ring, high contrast, readable at 3 meters).
5. Document key architectural decisions in `docs/DECISIONS.md`.
