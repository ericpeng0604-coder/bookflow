# BookFlow AI Handoff

## Task title

Add 30-second unread message polling

## Release context

- Task ID: `20260731-add-30-second-unread-message-polling`.
- Task: `Add 30-second unread message polling`.
- Branch: `codex/unread-polling-30s`.
- Base commit: `b6ea639e095d661d9359ff09b6653f806dcb6d5c`.
- History: `pending`.
- No database migration is included.
- No GitHub workflow or protected recovery file is changed.

## Completed work

- Added a 30-second fallback refresh for unread message summaries on visible, non-message views.
- Kept the existing Realtime subscription exclusive to the Messages list and active chat view.
- Added a focused regression check for the polling scope, visibility guard, and cleanup.

## Next steps

1. Run full local and release gates.
2. Commit the scoped implementation and synchronized metadata.
3. Open, verify, merge, and deploy the pull request.
4. Verify the exact deployed SHA and the visible/non-message refresh behavior in production.

## Changed files

- `components/marketplace-app.tsx`
- `scripts/check-unread-message-polling.mjs`
- `scripts/run-project-checks.mjs`
- `AI_HANDOFF.md`
- `.ai/state.json`
- A new `.ai/history/*.md` archive will be created when this task is completed.

## Verification

- Focused polling, notification-refresh, and refresh-guard checks pass.
- TypeScript and ESLint pass.
- Full project, production build, pull request, and production checks remain required.

## Risks and blockers

- The fallback adds one small conversation-summary request per visible non-message page every 30 seconds; it does not add a Realtime connection.
- Production behavior is not verified until the merged SHA is deployed and exercised in an authenticated browser session.

## AI follow-up

1. Keep `AI_HANDOFF.md`, `.ai/state.json`, and the matching `.ai/history/*.md` in sync.
2. Run `node scripts/ai-collaboration.mjs check-ci origin/main HEAD` before opening or merging the PR.
3. Do not claim production implementation until the merged SHA and production smoke checks match.

## Commit

- Base commit: `b6ea639e095d661d9359ff09b6653f806dcb6d5c`.
- Current implementation commit before final commit: `pending`.
