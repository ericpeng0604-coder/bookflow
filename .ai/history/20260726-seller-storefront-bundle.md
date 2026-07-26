# 2026-07-26 Seller storefront and bundle release

## Summary

Added stable seller storefront navigation and a multi-listing purchase-intent
bundle flow. Public storefront RPCs expose display fields only; contact data
remains private.

## Flow

- Public seller storefront with book, secondhand, and zero-price categories.
- Visitor selection is kept locally; Google login is required at submit.
- Unavailable listings remain visible and can be removed individually.
- One buyer/seller bundle supports whole-bundle accept, reject, cancel,
  reservation, dual confirmation, notifications, and seven-day expiry.
- The listing lifecycle cron invokes bundle expiry processing.

## Verification and blockers

- Direct TypeScript, ESLint, and Next production build passed in the clean
  release worktree.
- Project checks initially caught stale handoff branch metadata; metadata was
  updated and checks must be rerun.
- Supabase local lint requires a running local Postgres instance.
- Staging migration, production migration, PR merge, and production smoke are
  still required before claiming online completion.

## Process improvements

- Keep a tracked lockfile or make the dependency bootstrap path explicit.
- Have release tooling validate handoff branch and commit metadata automatically.
- Keep web deploy and database migration as separate gates with independent
  proof.