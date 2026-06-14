# BookFlow AI Handoff

## Goal

Deploy transaction refresh and notification-noise fixes.

## Implemented

- Opening **My Transactions** refreshes the active dashboard tab even when the
  user is already on that page.
- Returning to a visible browser tab refreshes the currently open transaction
  tab without restoring the removed global Realtime subscription.
- Opening the notification bell loads the feed, then marks only the fetched
  unread notification IDs as read. Notifications arriving during that request
  are not accidentally marked read.
- Repeated edits to the same purchase request now update one seller
  notification, move it to the top, and make it unread again instead of adding
  another row.
- Added the idempotent production migration
  `supabase/request-update-notification-dedupe.sql`.

## Verification

- TypeScript passed.
- ESLint passed with the same three existing non-blocking image warnings.
- Next.js production build passed.
- Trade workflow checks passed 14/14.
- Notification and transaction refresh checks passed 4/4.
- Refresh guard checks passed 7/7.
- Filter, lifecycle, browser push, and capacity checks passed.
- Local browser smoke test loaded the marketplace and login modal with no
  console errors.

## Release Steps

1. Push `codex/transaction-notification-refresh` and open a pull request.
2. Merge after required checks pass.
3. Apply `supabase/request-update-notification-dedupe.sql` in production
   Supabase and confirm it can be run repeatedly.
4. Confirm the Vercel production deployment is Ready.
5. Verify My Transactions refresh, bell auto-read, and merged request-edit
   notifications with authenticated accounts.

## Constraints

- Do not modify the protected rollback workflows or CODEOWNERS.
- Notifications continue using polling; only an open chat keeps a Realtime
  subscription.
- Production load testing remains prohibited without separate authorization.
