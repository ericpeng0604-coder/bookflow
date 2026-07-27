# AI Handoff Archive

- Task: secure legacy Books RLS and atomic reservations
- Actor: codex
- Status: in progress; staging verification required
- Base commit: `c41695f7157a2ed1c42db3992fb493559a493467`
- Updated at: 2026-07-27

The change adds a forward migration that removes known permissive Books
policies, recreates active-listing authorization, blocks suspended listing
writes, hardens `respond_to_purchase_request`, and hardens
`respond_to_bundle_purchase_request` by locking every active book in
deterministic order and asserting update counts. The 12 migrations already
present in staging/production but missing from this checkout were restored.

The migration applied successfully to staging and production. Policy/function
checks and the anonymous read/write probes passed in both environments.
Production's generated migration history version was reconciled to the source
version; this changed history metadata only. Staging has no suspended users
and not enough authenticated fixtures for a real two-session concurrency test,
so that test remains `NOT VERIFIED`. A staging-only concurrency harness was
added; it requires explicit staging credentials and confirmation before
creating exact, temporary fixtures.
