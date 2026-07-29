# Shared meetup information details modal release

- Branch: `codex/shared-meetup-info-release-main`.
- Base commit: `1f80386624267b4f03f999bf7efe811b02a889aa`.
- Scope: move shared meetup editing into transaction details, add a two-field
  modal, enforce fixed-location seller-only editing, and synchronize grouped
  order rows through the protected coordination RPC.
- Protected recovery files were not changed.
- The existing seller confirmation and shared coordination flow from
  `origin/main` was preserved.

## Verification

- Meetup helper tests passed (5/5).
- Shared meetup contracts passed (14/14).
- Trade chat checks passed (9/9).
- Chat/listing/order checks passed (33/33).
- Typecheck, production build, staging migration, and authenticated browser
  proof remain release-gate work.

## Release risks

- Staging has migration-history entries that are not all present locally;
  migration repair or remote application requires explicit approval.
- Production is not claimed until the exact merged SHA passes Vercel health and
  release smoke checks.
