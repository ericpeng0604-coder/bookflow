# 2026-07-16 — Student verification release

## Summary

Fixed long-lived moderator session failures during student-verification review
and exposed the recognized eight-digit student number for user confirmation.

## Scope

- Refresh and one-time retry for the authenticated review request.
- User-facing recognized student number and confirmation copy.
- Focused regression assertions and the related AI work-manual lesson.
- No new database migration; the required student-verification schema is already
  present on `origin/main`.

## Evidence target

- A moderator action refreshes an expiring session before Storage cleanup.
- A 401 response is retried once with the refreshed access token.
- The normal user panel shows the candidate number before submission.
