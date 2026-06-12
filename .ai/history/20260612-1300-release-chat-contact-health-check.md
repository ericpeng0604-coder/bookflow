# BookFlow Release History

- Task: Release chat notifications, contact privacy, search behavior, and setup health check
- Actor: Codex
- Status: Ready for production merge
- Base commit: `15387dce57c495d80751e615eb028de4e5322593`
- Date: 2026-06-12

## Changes

- Separated the hero search draft from the marketplace filter.
- Added trade-chat quick phrases and recipient notifications.
- Replaced automatic email exposure with seller-controlled Email, LINE ID, or
  no-sharing preferences.
- Stored consent-gated contact details in an RLS-protected private table.
- Added a local setup health check for Supabase, Resend, redirects, OTP, and
  notification prerequisites.
- Added a project rule requiring explicit warnings for work not yet deployed.

## Verification

- TypeScript `--noEmit`: passed.
- Filter encoding checks: passed.
- ESLint: zero errors; existing warnings remain.
- Next.js production build: passed.
- Browser page load: passed without runtime errors.
- Supabase production migration: executed successfully.
- Supabase structure verification: all six checks returned true.

## Remaining Release Step

- Merge PR #5 and confirm the Vercel production deployment is Ready.
- Verify the production search behavior and authenticated chat/contact flows.
