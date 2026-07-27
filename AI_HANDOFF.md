# BookFlow AI Handoff

## Task title

Admin OTP, order coordination, and responsive marketplace fixes

## Release context

- Task ID: `20260727-release-memory-guards`.
- Task: `release metadata and propagation guard hardening`.
- Branch: `codex/release-memory-guards-20260727`.
- Base commit: `4ba9aa7c741b7a946b3eb495bb8018f664f82011`.
- Base ref at merge resolution: `origin/main`.
- History: `.ai/history/20260727-release-memory-guards.md`.
- The latest main security-hardening release is included as the base; this PR adds only the admin/auth and marketplace UI fixes.
- No protected recovery files or GitHub workflows are changed.

## Completed work

- Added an early release-preflight stop when the handoff branch differs from the current checkout branch.
- Added a release-flow regression assertion for the new branch metadata guard.
- Documented propagation-aware exact-SHA production verification as LESSON-076.

## Next steps

1. Run the focused release-flow and memory checks.
2. Run release preflight and the applicable local quality gates.
3. Open a small PR and merge only after required checks pass.

## Changed files

- `app/globals.css`
- `components/marketplace-app.tsx`
- `scripts/check-chat-listing-order-ux.mjs`
- `scripts/check-turnstile.mjs`
- `AI_HANDOFF.md`
- `.ai/state.json`
- `AI_WORK_MANUAL.md`
- `.ai/history/20260727-release-memory-guards.md`

## Verification

- Focused checks: pending.
- Release preflight and local quality gates: pending.
- Production deployment is not in scope for this tooling-only guard until the PR merges.

## Risks and blockers

- This change only hardens local release checks and documentation; it does not alter application runtime behavior.

## AI follow-up

1. Keep the original dirty checkout untouched.
2. Keep this handoff, `.ai/state.json`, and the matching history entry synchronized.
3. Do not claim production deployment until the merged SHA and smoke evidence are confirmed.

## Commit

- Latest main base: `4ba9aa7c741b7a946b3eb495bb8018f664f82011`.
- Current implementation commit: pending.
