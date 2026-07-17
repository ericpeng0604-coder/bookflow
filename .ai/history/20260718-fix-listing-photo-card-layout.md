# 20260718 listing photo card layout fix

## Scope

Fix only the deployed listing form photo-guide layout. No chat, transaction,
Supabase, image-upload behavior, or other product logic changes are included.

## Root cause

The photo-guide parent grid used `minmax(0, 1fr)` for its text column. At the
production modal width the track could collapse to nearly zero, so the child
flex rule could not prevent Chinese text from rendering one character per line.

## Change

The desktop grid now reserves at least 240px for the guidance column and 220px
for the action column. The existing mobile one-column media rule remains in
place.

## Evidence

- `pnpm run typecheck:codex` passed.
- `pnpm run lint` passed.
- `pnpm run check:listing-ui` passed.
- `git diff --check` passed.
