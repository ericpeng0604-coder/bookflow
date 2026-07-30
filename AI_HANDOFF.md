# BookFlow AI Handoff

## Task title

production deploy: mobile messages layout

## Release context

- Task ID: `20260730-production-deploy-mobile-messages-layout`.
- Task: `production deploy: mobile messages layout`.
- Branch: `codex/messages-meetup-production-verify-20260730`.
- Base commit: `090ef2308fc6a61f7616af3b48ddfd0eca96302a`.
- History: `.ai/history/20260730-production-deploy-mobile-messages-layout.md`.
- No database migration is included.
- Protected recovery files and workflows are unchanged.

## Completed work

- Wrapped the multi-photo detail gallery so thumbnails remain below the main image and the product information stays in the second desktop column.
- Made the standalone mobile messages workspace fill the available viewport below the site header.
- Prevented the mobile show/hide list control from shrinking and clipping its label.

## Verification

- Chat listing and order UX checks passed (35/35).
- TypeScript check passed.
- ESLint passed.
- Production build passed.
- Focused mobile messages layout check passed (6/6).
- Authenticated browser proof is pending until the release candidate is merged and deployed.

## Next steps

1. Commit only the scoped UI files and synchronized handoff metadata.
2. Run release preflight and open a draft PR for GitHub/Vercel deployment.
3. After merge, verify the exact production SHA with `/api/health/release` and `release:smoke`.

## Changed files

- `app/globals.css`
- `components/marketplace-app.tsx`
- `AI_HANDOFF.md`
- `.ai/state.json`
- `.ai/history/20260730-production-deploy-mobile-messages-layout.md`

## Risks and blockers

- No database or production migration is included.
- Production deployment and exact-SHA smoke remain pending until the PR is merged.

## AI follow-up

1. Keep `AI_HANDOFF.md`, `.ai/state.json`, and the matching `.ai/history/*.md` in sync.
2. Run `node scripts/ai-collaboration.mjs check-ci origin/main HEAD` before opening or merging the PR.
3. Do not claim production implementation until the merged SHA and production smoke checks match.

## Commit

- Base commit: `090ef2308fc6a61f7616af3b48ddfd0eca96302a`.
- Current implementation commit before final commit: `pending`.
