# BookFlow AI Handoff

## Task

Secure legacy Books RLS policies and make seller reservations atomic.

## Scope

- Added `supabase/migrations/20260727060919_secure_book_rls_and_atomic_reservations.sql`.
- Restored the 12 migration files already present in staging/production but missing from this checkout.
- Removed known permissive legacy Books policies before recreating the active-listing model.
- Blocked anonymous writes and suspended-user listing writes through RLS.
- Locked the request and its listing during acceptance and asserted both update row counts.
- Locked every active book in a bundle in deterministic order and asserted the updated book count.
- Added `scripts/check-security-hardening.mjs` and the `check:security-hardening` package script.
- Added staging-only `scripts/check-bundle-concurrency.mjs`; it creates and removes exact temporary auth/database fixtures and requires an explicit staging project ref plus confirmation flag.

## Verification

- Security-hardening static contract: passed.
- Node syntax check: passed.
- `git diff --check`: passed.
- Supabase CLI/psql/docker are unavailable in this environment; direct staging verification used the connected Supabase database tool.
- Staging migration `secure_book_rls_and_atomic_reservations` applied successfully.
- Staging policy/function/anon-write probes passed; staging has no suspended users and insufficient fixtures for a real two-session concurrency test.
- The concurrency harness is ready but was not run because staging credentials/confirmation were not present in this shell.
- No production migration or production data mutation was performed.

## Release requirements

1. Run the repository staging workflow and confirm the exact migration history.
2. Add authenticated staging fixtures for suspended-user and two-session concurrency tests.
3. Review existing advisor warnings separately from this change.
4. Apply to production only with explicit production database approval, then verify release health and reservation behavior.

Protected rollback files were not changed.
