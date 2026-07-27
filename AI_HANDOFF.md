# BookFlow AI Handoff

## Task title

Secure legacy Books RLS policies and make seller reservations atomic.

## Release context

- Task ID: `20260727-security-hardening`.
- Task: `secure legacy Books RLS and atomic reservations`.
- Branch: `codex/security-hardening-20260727`.
- Base commit: `c41695f7157a2ed1c42db3992fb493559a493467`.
- History: `.ai/history/20260727-security-hardening.md`.
- Production database migration and history reconciliation are complete.
- No protected recovery files or GitHub workflows were changed.

## Completed work

- Removed known permissive legacy Books policies and recreated the active-listing authorization model.
- Blocked anonymous writes and suspended-user listing writes through RLS.
- Locked the request and listing during single-item acceptance with update-count assertions.
- Locked every active book in a bundle in deterministic order with an updated-book-count assertion.
- Added the security contract and staging concurrency harness.
- Ran the staging two-session concurrency test: exactly one bundle was reserved and the other received `A selected listing is unavailable`.
- Removed all temporary staging auth, profile, book, bundle, item, and notification fixtures.

## Next steps

1. Wait for PR checks, merge the approved branch, and confirm the Vercel production deployment.
2. Verify `/api/health/release`, homepage, and marketplace count against the merged SHA.
3. Keep the staging concurrency harness available for future regression runs.

## Changed files

- `supabase/migrations/20260727060919_secure_book_rls_and_atomic_reservations.sql`
- `scripts/check-security-hardening.mjs`
- `scripts/check-bundle-concurrency.mjs`
- `package.json`
- `AI_HANDOFF.md`
- `.ai/state.json`
- `.ai/history/20260727-security-hardening.md`
- Restored versioned migrations under `supabase/migrations/` required by staging and production history.

## Verification

- `node scripts/check-security-hardening.mjs`: passed.
- `node --check scripts/check-bundle-concurrency.mjs`: passed.
- `git diff --check`: passed.
- Staging concurrent bundle accepts: passed; one success, one unavailable error, one reserved book.
- Staging fixture cleanup: passed; zero auth users, profiles, books, bundles, and items remained.
- Production RLS/RPC/anonymous read-write probes: passed.
- Production migration history: aligned to `20260727060919`.
- Production web deployment and merged-SHA health: NOT VERIFIED; current endpoint still reports `c41695f7157a2ed1c42db3992fb493559a493467`.

## Risks and blockers

- The production web deployment must propagate the merged `main` commit before release health can be called verified.
- Existing Supabase advisor notices are broader pre-existing findings and were not changed by this task.
- No suspended-user fixture was available in staging; suspended-user RLS is covered by the migration contract and policy probes, but a live suspended-session test remains NOT VERIFIED.

## AI follow-up

1. Preserve the exact migration history and do not rerun the migration manually.
2. Verify the deployed commit through `/api/health/release` before claiming production completion.
3. Keep `AI_HANDOFF.md`, `.ai/state.json`, and `.ai/history/*.md` in sync.

## Commit

- Base commit: `c41695f7157a2ed1c42db3992fb493559a493467`.
- Current implementation commit before final handoff update: `7140e9432d42c06ede282958f97b23ad165792a0`.
