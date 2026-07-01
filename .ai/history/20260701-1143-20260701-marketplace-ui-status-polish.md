# 20260701-marketplace-ui-status-polish

- Actor: codex
- Branch: `codex/marketplace-ui-status-polish`
- Base commit: `a4ad6f7c34702d4c21317d86b9548755d604bb01`
- Status: in progress

## Summary

Prepared a focused marketplace UI release from a clean `origin/main` worktree.

## Changes

- Styled the existing OCR progress bar for clearer recognition feedback.
- Stabilized the marketplace grid during search refreshes.
- Hid placeholder textbook fields in listing cards and detail views.
- Removed expired purchase requests from dashboard tab badge counts.
- Stopped pending or inactive listings from displaying a misleading `販售中` badge.

## Verification

- `node scripts/run-project-checks.mjs`: passed, 23/23.
- `node node_modules/typescript/bin/tsc --noEmit`: passed.
- `node node_modules/next/dist/bin/next build`: passed.
- Standalone ESLint is blocked locally by the existing `eslint-config-next` and Rushstack patch compatibility issue.

## Release Notes

- No database migration.
- No protected rollback workflow changes.
- Production proof should use `/api/health/release` plus `release-smoke` against `https://bookflow-green.vercel.app`.
