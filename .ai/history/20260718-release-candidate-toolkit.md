# 2026-07-18 Release candidate toolkit

## Summary

Added a local-first release candidate runner for multi-file working-tree
changes. It records reproducible local gate evidence, rejects stale evidence
and unsafe release scope, and leaves remote deployment gates explicit.

## Scope

- Added `release:local`, `release:prepare`, and `release:watch` commands.
- Added JSON and Markdown evidence reports plus release candidate manifests.
- Added secret, unreadable-text, protected-file, migration, and worktree checks.
- Updated Release Readiness to run the same local runner and upload its evidence.
- No database migration and no protected recovery file change.

## Verification

- Node syntax checks: passed.
- Release candidate regression tests: passed.
- Release flow contract check: passed.
- Full local gate run: pending dependency installation in the clean worktree.
