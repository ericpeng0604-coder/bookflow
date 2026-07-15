# Student verification Storage API fix

- Base: `9c4dea468e2ccbf7a9d68cd7d24bbe732770ea96`
- Scope: fix student-card review cleanup, improve school-name OCR, hide the
  sparse-text badge, and add moderator image zoom.
- Storage cleanup now runs through a server-side Supabase Storage API route;
  the replacement SQL functions only update the database record.
- Local verification passed: typecheck, targeted lint, student verification
  checks, diff check, and production build.
- No protected recovery file changed and no credentials or personal data were
  added.
