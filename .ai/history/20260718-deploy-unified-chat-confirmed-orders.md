# 2026-07-18 deploy unified chat and confirmed orders

## Scope

Release the isolated, chat-related changes from `origin/main` without carrying over unrelated edits from the user's dirty checkout.

## Changes

- Canonicalize all message entry points to the standalone chat route.
- Prevent stale dashboard state from rendering the old chat shell when the URL is already `view=chat`.
- Add the confirmed-orders workspace tab for `reserved`, `awaiting_confirmation`, and `completed` requests.
- Show a visible test version marker and allow an environment override.

## Evidence

- Source checks, typecheck, chat switching, confirmed-orders, and site-version checks passed before release publication.
- No migration, RLS, protected recovery workflow, or database schema change is included.
- Production build and live smoke remain release-gate evidence to be collected after CI and deployment.

## Prevention

Keep the release worktree, handoff metadata, branch, and final deployment SHA aligned. Treat a URL/state mismatch or a production SHA mismatch as a release failure.
