# 2026-07-17 Mobile chat report menu release

## Scope

- The mobile chat header uses one horizontal row with the Return to messages control, the participant, and the ellipsis action.
- The chat safety menu is no longer clipped by the chat panel overflow rule.
- No database, RPC, workflow, or protected recovery file changes.

## Evidence

- Chat listing/order UX checks: 26/26 passed.
- Chat visibility/feedback checks: 11/11 passed.
- Project checks: 29/29 passed.
- Typecheck passed.
- Production build generated 22/22 static pages successfully.
- ESLint direct verification is not available in the release worktree because the existing dependency tree lacks `eslint-plugin-react-hooks`; this is recorded as an environment limitation, not a product failure.

## Release proof required

- Required PR checks must pass before merge.
- After merge, compare `/api/health/release` with the merged SHA and run production release smoke.
