# 2026-07-02 Image Search Optimization Release

## Scope

- Optimize BookFlow site-local image search for marketplace books.
- Keep the release application-only: no database migration, no workflow change, no protected recovery-file change.
- Exclude untracked hero draft images from the release.

## Implementation

- Added `buildImageSearchPlan` to produce a display query, candidate queries, and scoring tokens.
- Added `rankImageSearchResults` to score title, author, edition, publisher, and metadata matches.
- Added `fetchImageSearchCandidates` as a wrapper around the existing `list_books_page` RPC.
- Updated marketplace image-search UI to show recognized text, ranked result counts, and normal-search fallback.
- Expanded regression checks through `scripts/check-image-search.mjs`.

## Evidence

- Local project checks passed: 25/25.
- Typecheck, lint, production build, diff whitespace, encoding check, image-search check, OCR/AI checks, mobile OCR check, and home accessibility check passed.
- Local browser smoke confirmed desktop and 390px mobile image-search entry points and no mobile horizontal overflow.

## Release Notes

- The first PR attempt reused `codex/homepage-review-tweaks`, which had already been merged. A clean branch from latest `origin/main` is the intended release branch.
