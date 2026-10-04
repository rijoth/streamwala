## Summary

<!-- What does this change, and why? Link the issue if there is one. -->

## Checklist

- [ ] `npm run check` passes locally (typecheck, ESLint, Vitest coverage, Playwright)
- [ ] Every commit is signed off with `git commit -s`, as required by `CONTRIBUTING.md`
- [ ] UI changes need tests. Geometry-dependent D-pad behaviour is covered by a Playwright spec; jsdom is only for non-geometric behaviour (AGENTS.md Rule 9)
- [ ] Docs updated if behaviour or a decision changed
