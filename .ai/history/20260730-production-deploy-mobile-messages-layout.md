# Production deploy: mobile messages layout

- Branch: `codex/messages-meetup-production-verify-20260730`.
- Base commit: `090ef2308fc6a61f7616af3b48ddfd0eca96302a`.
- Scope: make the desktop empty conversation state fill the right panel and make the mobile messages list and collapsed state use the full available width.
- Existing gallery, cart, and shared meetup behavior from `origin/main` was preserved.
- Protected recovery files and workflows were not changed.

## Verification

- Mobile messages layout contracts passed (6/6).
- Chat listing/order UX contracts passed (35/35).
- Shared meetup contracts passed (14/14).
- Meetup helper tests passed (5/5).
- Typecheck, lint, production build, release preflight, and exact-SHA production proof remain release gates.

## Release risks

- Production is not claimed until the PR is merged and `/api/health/release` plus release smoke report the same full SHA.
- Authenticated browser proof remains pending until the deployed candidate is available.
