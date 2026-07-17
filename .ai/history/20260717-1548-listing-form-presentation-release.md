# 20260717 listing form presentation release

## Scope

This release carries only the follow-up UI pass from the current chat onto the
already deployed chat and book-gallery baseline: three listing form sections,
the six-photo upload guide, cover status messaging, and mobile text layout.
No database migration or unrelated student-verification, moderation, or
memory-tool changes are included.

## Root cause

The production deployment was already on the merged chat and gallery commit,
but the later listing-form presentation work remained in the dirty local
checkout and therefore was not part of production.

## Evidence

- `pnpm run typecheck` passed.
- `pnpm run lint` passed.
- `pnpm run build` passed.
- `pnpm run check:project` passed (31/31).
- Listing navigation, OCR, and chat UX checks passed.
