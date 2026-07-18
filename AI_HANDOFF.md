# BookFlow AI Handoff

## Task

- Task ID: `20260718-mobile-gallery-version-release`.
- Task: `fix mobile multi-image details and release versioning`.
- Branch: `codex/release-candidate-toolkit`.
- Base commit: `b789ae4e7d5616392862dde2165ac78e998e56cf`.
- History: `.ai/history/20260718-mobile-gallery-version-release.md`.
- No database migration is included in the current changes.
- Protected recovery files are unchanged.

## Completed

- Normalized `image_url` and `image_urls` with cover-first ordering, empty-value removal, and URL deduplication.
- Hydrated incomplete detail galleries and preserved compatibility with legacy single-image records.
- Added mobile main-image controls, count indicator, horizontal thumbnails, safe fallback, and six-image preloading.
- Added a low-contrast footer version sourced from `package.json`.
- Added the compact hidden-list UI regression check and book-gallery regression check.
- Added `release:version:patch`, which increments the patch version by `0.0.1` and updates the lockfile for each production deployment.

## Verification

- Memory contract: passed.
- Book gallery regression check: passed.
- Chat/listing order UX check: passed.
- TypeScript, ESLint, project checks, and production build: passed before final release rerun.
- Local browser auth smoke reached the Google account chooser with public Supabase configuration; no credentials were stored.

## Release handoff

- Feature commit: `d816a8d`.
- Run `node scripts/release-preflight.mjs` before opening or merging the PR.
- After merge, verify the exact deployed SHA with `/api/health/release` and `release:smoke`.
