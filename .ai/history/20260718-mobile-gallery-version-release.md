# 2026-07-18 Mobile gallery and version release

## Summary

Prepared the existing release-candidate worktree for the mobile multi-image
product-detail fix and the low-contrast footer version marker.

## Scope

- Normalize cover and gallery image data, including legacy single-image rows.
- Hydrate incomplete detail galleries and preload up to six images.
- Keep mobile gallery controls and thumbnails inside the viewport.
- Add the compact hidden-list UI regression coverage.
- Increment the site patch version from `0.1.0` to `0.1.1` and add a repeatable
  `release:version:patch` command for future production deployments.
- No database migration or protected recovery file change.

## Verification

- Memory, gallery, chat/listing UX, TypeScript, ESLint, project checks, and
  production build are required again after the final release metadata update.
- Local auth smoke reached the Google account chooser only with process-local
  public Supabase configuration; no credentials were written to the worktree.

## Release note

Production deployment must use the exact merged commit SHA for health and smoke
verification. The footer version is sourced from `package.json`.
