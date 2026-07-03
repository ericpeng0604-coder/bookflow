# 2026-07-04 Mobile Marketplace And Chat UX

## Summary

Prepared a clean release branch from latest `origin/main` for the requested mobile UX fixes. The source worktree was stale, so this branch intentionally includes only the mobile UX patch and matching checks.

## Confirmed Scope

- Mobile hero search arrow and course-search guide.
- Mobile filter tap-target polish.
- Listing form `課堂名稱（選填）` copy and inline help.
- Detail-page favorite toggle.
- Chat scroll preservation, long-message wrapping, long compose input, quick phrase scrolling, and new-message jump button.
- Dashboard URL state preservation for refresh.
- Seller received-order tracking copy and chat access after confirmation/completion.

## Verification

- Targeted checks passed in the source worktree before this clean release branch was prepared.
- `node scripts/run-project-checks.mjs`: passed in the clean release worktree, 26/26 checks.
- `node node_modules/typescript/bin/tsc --noEmit`: passed in the clean release worktree.
- `node node_modules/eslint/bin/eslint.js .`: passed in the clean release worktree.
- `node node_modules/next/dist/bin/next build`: passed in the clean release worktree.

## Notes

- No database migration is required.
- No protected recovery files are changed.
- Do not add `Rollback-Workflow-Approved: true`.
