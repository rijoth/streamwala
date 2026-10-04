# Contributing to Streamwala

Thanks for taking the time to help. This file covers how to build and check
the project, how to write commits, and the sign-off rules.

## Before you start

For bugs, open an issue with what you did, what you expected and what actually
happened. For a UI or D-pad bug, a screenshot or a short recording saves a lot
of guessing. If you plan a large change, open an issue first so we can agree on
the approach before you write code.

## Getting it running

You need Node 24, which is what CI uses.

    npm install
    npm run dev

That serves on port 3000. To check your work the way CI does:

    npm run lint           # tsc --noEmit
    npm run lint:eslint    # ESLint, including the custom guardrail rules
    npm run test           # Vitest
    npm run test:coverage  # Vitest with coverage thresholds
    npm run e2e            # Playwright Chromium (run npx playwright install chromium first)
    npm run check          # all of the above, in order

`npm run check` has to pass before a change lands. Do not lower a coverage
threshold or delete an assertion to make it pass.

The rules the codebase is held to are in `AGENTS.md`. Two that surprise people:
arrow-press handlers return the branded `ALLOW_DEFAULT_NAVIGATION` or
`BLOCK_NAVIGATION` sentinels, never a plain boolean; and UI bug fixes need a
regression test, a component test for logic and a Playwright spec when the
behaviour depends on layout geometry.

## Commits

Write Conventional Commits: a type, an optional scope, then a short imperative
subject.

    fix(epg): stop refresh hanging at "Downloading... 0 B"
    feat(search): match on channel number

Keep the subject short. Put the why in the body when it is not obvious, and
keep one logical change per commit.

## Sign-off (required)

Every commit must end with a line like:

    Signed-off-by: Your Name <you@example.com>

Use your real name and an email you can be reached at. The easiest way is to
add `-s` to every commit:

    git commit -s -m "fix(live-tv): keep focus on the channel grid"

By signing off you agree to two things.

First, you certify the Developer Certificate of Origin 1.1. The full text is in
the `DCO` file. In short, you confirm that you wrote the contribution or have
the right to submit it under this project's license, and that it is not someone
else's work passed off as your own.

Second, you grant the project owner (Rijo Thomas) a perpetual, worldwide,
irrevocable license to use, modify and sublicense your contribution, including
the right to relicense it under other terms. The project is GPL-3.0-only today;
this grant is what allows it to be offered under a different license later, for
example a commercial or dual license, without tracking down every past
contributor. You keep the copyright to your own work.

If you cannot agree to both, please do not sign off and do not send the patch.

### If you forgot the sign-off

For the most recent commit, add the sign-off and keep the message:

    git commit --amend -s --no-edit

For several commits on your branch:

    git rebase --signoff <base>

then force push your branch. The DCO check in CI fails a pull request that has
any commit without a valid sign-off, so it is worth fixing before you ask for
review.

## Questions

Open an issue, or email rijothomas64@gmail.com.
