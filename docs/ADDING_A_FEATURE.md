# Adding a New Feature (docs/ADDING_A_FEATURE.md)

Follow this checklist when adding or expanding a feature in Streamwala. See
[`GUARDRAILS.md`](./GUARDRAILS.md) and [`../AGENTS.md`](../AGENTS.md) for the
rules each step protects.

1. **Domain Models**: Define new entity types and Zod validation schemas in
   `src/domain/types.ts` / `src/domain/schemas.ts`. Domain stays free of React
   and I/O.

2. **Storage Repository**: If data persists, add schema versions or indices in
   `src/services/storage/db.ts` and write pure query helpers. The helpers take an
   optional `database` handle (so tests can use an isolated fake-indexeddb).
   - **Any Dexie schema change requires a new `.version(n)` with an
     `.upgrade()` function and a migration test** (AGENTS Rule 10). Never edit an
     existing version's stores in place.
   - Add storage tests in `src/services/storage/` (cascade/orphan checks where
     relationships exist).

3. **Feature Directory Structure**: Create `src/features/<feature-name>/`:
   - `components/`: UI components wrapping every interactable with
     `useFocusable`.
   - `state/`: Zustand store or TanStack Query hooks.
   - `index.ts`: Barrel file exporting only the public API.
   - `README.md`: Feature overview and exported props.

4. **10-Foot Remote Verification**:
   - Arrow handlers must return a `FocusDecision` sentinel
     (`ALLOW_DEFAULT_NAVIGATION` / `BLOCK_NAVIGATION`) from `src/shared/focus`;
     never a raw boolean (Rule 7).
   - Keyboard input goes through `src/shared/input`; never add raw key listeners
     (Rule 8).
   - Verify every card/button has a focus ring (`tv-focus-target`,
     `tv-focused`), D-pad navigation, BACK behaviour, and no focus trap.
   - If the screen scrolls, use the shared scroller hooks and never
     `scrollIntoView`; see [`SCROLLING.md`](./SCROLLING.md).
   - Add a component test (Vitest + Testing Library) for non-geometric behaviour
     and a **Playwright D-pad traversal test** in `e2e/` for the screen
     (Rule 9).

5. **Quality Gate**: Run `npm run check` — typecheck, ESLint guardrails, Vitest
   coverage thresholds, and Playwright. All must pass before review.
