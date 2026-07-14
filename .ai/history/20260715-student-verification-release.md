# 2026-07-15 — Student seller verification release

## Summary

Added optional student-card OCR verification in `我的交易`, moderator review,
derived student ID metadata, and verified-seller priority ordering for books and
secondhand listings.

## Evidence

- OCR parsing accepts the current five-year window and class codes 1, 2, 3, or
  other single digits.
- No manual student ID input is available; OCR failure requires a new upload.
- TypeScript, ESLint, custom student verification checks, and production build
  passed in the isolated release worktree.
- Migration and staging RLS probes remain pending staging credentials.
- Production deployment remains pending PR checks, migration approval, and
  merge.
