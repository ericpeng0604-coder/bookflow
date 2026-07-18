# 2026-07-18 Figma homepage market-switch pilot

## Scope

- Clean release worktree from `origin/main` at
  `62531360d518171c7557238324e453f5ca199d15`.
- Private Figma file: `https://www.figma.com/design/eBGxlegWs8bZ9Ei6gTSVS8`.
- Add a scoped `:focus-visible` ring to the homepage market switch and a
  focused static regression assertion.
- Add the durable Figma workflow contract in `docs/FIGMA_WORKFLOW.md`.

## Evidence

- `node scripts/check-listing-navigation-ui.mjs`: passed after the pilot patch.
- `node scripts/check-home-accessibility.mjs`: baseline passed.
- `pnpm run typecheck:codex`: passed with the bundled runtime dependencies.
- `pnpm run lint`: passed.
- `node scripts/run-project-checks.mjs`: passed (34/34).
- Production build: passed (22/22 routes).
- `node scripts/check-memory.mjs`: passed; handoff/state aligned.
- `node scripts/ai-collaboration.mjs check-ci origin/main HEAD`: passed.
- Commit: `ffb8f6bf15977fef47a966f1e7ae4ea5e2d983ae`.
- Draft PR: `https://github.com/ericpeng0604-coder/bookflow/pull/121`.
- Figma capture/readback: `NOT VERIFIED`; the capture stayed pending and the
  browser page did not expose the capture script.
- No database migration and no protected recovery-file change.

## Follow-up

Retry the Figma capture from a browser surface that injects the capture script,
then inspect the exact node before treating the visual roundtrip as complete.
