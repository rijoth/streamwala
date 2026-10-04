# Adding a New Feature (docs/ADDING_A_FEATURE.md)

Follow this 5-step checklist when adding or expanding a feature in Aether IPTV:

1. **Domain Models**: If new entities are needed, define their TypeScript types and Zod validation schemas in `src/domain/types.ts`.
2. **Storage Repository**: If data persists, add schema versions or indices in `src/services/storage/db.ts` and write pure query helpers.
3. **Feature Directory Structure**: Create `src/features/<feature-name>/`:
   - `components/`: UI components with `useFocusable` wrapping every interactable.
   - `state/`: Zustand store or TanStack Query hooks.
   - `index.ts`: Barrel file exporting only the public API.
   - `README.md`: Feature overview and exported props.
4. **10-Foot Remote Verification**:
   - Verify every card/button has focus ring (`tv-focus-target`, `tv-focused`).
   - Test D-pad navigation, back button behavior, and no focus trap.
5. **Quality Gate**: Run `npm run lint` and `npm run build`.
