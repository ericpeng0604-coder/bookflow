# 2026-07-03 Image Search No-Query Release

## Scope

- Deploy a follow-up to BookFlow site-local image search.
- Keep image-search OCR text out of the normal marketplace search input.
- Preserve dedicated image-search status text so users can see what content was
  used for matching.
- No database migration, workflow change, or protected recovery-file change is
  included.

## Implementation

- Removed `setQuery(finalPlan.displayQuery)` from the image-search success path.
- Left `setImageSearchQuery(finalPlan.displayQuery)` in place for the dedicated
  image-search state area.
- Added `assert.doesNotMatch(... setQuery(finalPlan.displayQuery) ...)` to
  `scripts/check-image-search.mjs`.

## Evidence

- `git diff --check`: passed.
- `node --experimental-strip-types scripts/check-image-search.mjs`: passed.
- `node scripts/run-project-checks.mjs`: passed, 25/25.
- `tsc --noEmit`: passed.
- `eslint .`: passed.
- `next build`: passed.
- Release preflight, GitHub PR checks, and production smoke are pending.

## Release Notes

- This release is isolated in a clean worktree from latest `origin/main` to
  avoid carrying unrelated local edits from the active checkout.
