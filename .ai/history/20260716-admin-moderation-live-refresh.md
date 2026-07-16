# 2026-07-16 — Admin moderation live refresh

## Summary

Optimized the administrator moderation queue for fast feedback after approval
or rejection actions. The admin view updates immediately while complete
moderation and risk projections refresh in the background.

## Scope

- Non-blocking admin moderation reloads after successful mutations.
- Optimistic student-verification queue removal with rollback on failure.
- Admin-only Realtime invalidation, focus/visibility refresh, and ten-second
  fallback polling.
- Versioned Supabase Realtime publication migration and focused checks.
- User-side real-time delivery is intentionally out of scope for this release.

## Evidence target

- A student-verification action shows immediate admin feedback and removes the
  card before the server request completes.
- Failed review requests restore the card and show the error.
- Admin Realtime events trigger the existing protected moderator projection;
  periodic refresh keeps the queue current when an event is missed.
