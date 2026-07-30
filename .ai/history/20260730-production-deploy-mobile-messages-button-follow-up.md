# Production deploy: mobile messages button containment follow-up

- Branch: `codex/mobile-messages-button-fix-20260730`.
- Base commit: `f43d499efdf54a5f1b9d54d47254b67dd7e0d272`.
- Scope: keep the mobile messages header and its show/hide list button fully inside the narrow message panel.
- No database migration or protected recovery file is included.

## Verification

- Mobile messages layout contracts passed (7/7).
- Chat listing/order UX contracts passed (35/35).
- TypeScript, ESLint, and production build passed.
- Authenticated production browser proof remains pending until this follow-up is deployed.
